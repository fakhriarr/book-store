"""
FastAPI Microservice untuk Apriori Analysis
Port: 5001
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
from dotenv import load_dotenv

from apriori_engine import (
    prepare_transactions_by_book,
    prepare_transactions_by_category,
    run_apriori,
    generate_bundling_recommendations
)

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Apriori Service",
    description="Market Basket Analysis untuk Toko Buku",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'book_store'),
    'port': int(os.getenv('DB_PORT', 3306))
}

# Minimum transactions required for Apriori
MIN_TRANSACTIONS = 10


def get_db_connection():
    """Create database connection"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except mysql.connector.Error as e:
        print(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "service": "Apriori Analysis Service"}


@app.get("/api/apriori/health")
async def health_check():
    """Health check with database connectivity"""
    try:
        conn = get_db_connection()
        conn.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


@app.get("/api/apriori/insights")
async def get_apriori_insights(
    min_support: float = 0.05,
    min_confidence: float = 0.3
):
    """
    Generate bundling insights menggunakan algoritma Apriori
    
    Parameters:
    - min_support: minimum support threshold (default 0.05 = 5%)
    - min_confidence: minimum confidence threshold (default 0.3 = 30%)
    """
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 1. Cek jumlah transaksi
        cursor.execute("SELECT COUNT(DISTINCT transaction_id) as total FROM transactions")
        total_transactions = cursor.fetchone()['total']
        
        if total_transactions < MIN_TRANSACTIONS:
            return {
                'success': False,
                'message': f'Data transaksi belum mencukupi. Minimal {MIN_TRANSACTIONS} transaksi diperlukan, saat ini ada {total_transactions} transaksi.',
                'total_transactions': total_transactions,
                'min_required': MIN_TRANSACTIONS,
                'recommendations': None
            }
        
        # 2. Query data transaksi dengan judul buku
        cursor.execute("""
            SELECT 
                ti.transaction_id,
                b.title,
                b.category
            FROM transaction_items ti
            JOIN books b ON ti.book_id = b.book_id
            JOIN transactions t ON ti.transaction_id = t.transaction_id
            ORDER BY ti.transaction_id
        """)
        raw_data = cursor.fetchall()
        
        if not raw_data:
            return {
                'success': False,
                'message': 'Tidak ada data item transaksi ditemukan.',
                'total_transactions': total_transactions,
                'recommendations': None
            }
        
        # 3. Prepare transactions untuk analisis per buku
        book_transactions = prepare_transactions_by_book(raw_data)
        
        # 4. Prepare transactions untuk analisis per kategori
        category_transactions = prepare_transactions_by_category(raw_data)
        
        # 5. Cek apakah ada transaksi multi-item
        if not book_transactions and not category_transactions:
            return {
                'success': False,
                'message': 'Belum ada transaksi dengan lebih dari 1 item. Apriori membutuhkan transaksi multi-item untuk menemukan pola asosiasi.',
                'total_transactions': total_transactions,
                'multi_item_transactions': 0,
                'recommendations': None
            }
        
        # 6. Run Apriori untuk buku
        book_rules = run_apriori(book_transactions, min_support, min_confidence)
        
        # 7. Run Apriori untuk kategori (dengan threshold lebih rendah karena lebih sedikit unique items)
        category_rules = run_apriori(
            category_transactions, 
            min_support=max(0.03, min_support - 0.02),  # slightly lower threshold
            min_confidence=min_confidence
        )
        
        # 8. Generate recommendations
        recommendations = generate_bundling_recommendations(book_rules, category_rules)
        
        # 9. Tambahkan metadata
        return {
            'success': True,
            'message': 'Analisis Apriori berhasil dijalankan.',
            'total_transactions': total_transactions,
            'multi_item_transactions': {
                'books': len(book_transactions),
                'categories': len(category_transactions)
            },
            'parameters': {
                'min_support': min_support,
                'min_confidence': min_confidence
            },
            'recommendations': recommendations
        }
        
    except mysql.connector.Error as e:
        print(f"Database error: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")
    
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/apriori/stats")
async def get_transaction_stats():
    """
    Get transaction statistics untuk dashboard
    """
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Total transaksi
        cursor.execute("SELECT COUNT(*) as total FROM transactions")
        total_transactions = cursor.fetchone()['total']
        
        # Transaksi dengan multi-item
        cursor.execute("""
            SELECT COUNT(*) as multi_item_count
            FROM (
                SELECT transaction_id, COUNT(*) as item_count
                FROM transaction_items
                GROUP BY transaction_id
                HAVING item_count > 1
            ) as multi_items
        """)
        multi_item_transactions = cursor.fetchone()['multi_item_count']
        
        # Rata-rata item per transaksi
        cursor.execute("""
            SELECT AVG(item_count) as avg_items
            FROM (
                SELECT transaction_id, COUNT(*) as item_count
                FROM transaction_items
                GROUP BY transaction_id
            ) as item_counts
        """)
        avg_items = cursor.fetchone()['avg_items'] or 0
        
        return {
            'total_transactions': total_transactions,
            'multi_item_transactions': multi_item_transactions,
            'avg_items_per_transaction': round(float(avg_items), 2),
            'min_required_for_apriori': MIN_TRANSACTIONS,
            'ready_for_analysis': total_transactions >= MIN_TRANSACTIONS
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Apriori Service on http://localhost:5001")
    uvicorn.run("app:app", host="0.0.0.0", port=5001, reload=True)