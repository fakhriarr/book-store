import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder


def prepare_transactions_by_book(raw_data: list[dict]) -> list[list[str]]:
    df = pd.DataFrame(raw_data)
    if df.empty:
        return []
    
    # Group by transaction_id, collect all book titles
    transactions = df.groupby('transaction_id')['title'].apply(list).tolist()
    
    # Filter transaksi yang memiliki lebih dari 1 item (untuk asosiasi)
    transactions = [t for t in transactions if len(t) > 1]
    
    return transactions


def prepare_transactions_by_category(raw_data: list[dict]) -> list[list[str]]:
    df = pd.DataFrame(raw_data)
    if df.empty:
        return []
    
    # Group by transaction_id, collect unique categories per transaction
    transactions = df.groupby('transaction_id')['category'].apply(
        lambda x: list(set(x))  # unique categories per transaction
    ).tolist()
    
    # Filter transaksi yang memiliki lebih dari 1 kategori
    transactions = [t for t in transactions if len(t) > 1]
    
    return transactions


def run_apriori(transactions: list[list[str]], min_support: float = 0.05, min_confidence: float = 0.3) -> list[dict]:
    if not transactions or len(transactions) < 2:
        return []
    
    try:
        # Encode transactions ke format one-hot
        te = TransactionEncoder()
        te_array = te.fit(transactions).transform(transactions)
        df_encoded = pd.DataFrame(te_array, columns=te.columns_)
        
        # Jalankan Apriori untuk menemukan frequent itemsets
        frequent_itemsets = apriori(
            df_encoded, 
            min_support=min_support, 
            use_colnames=True,
            max_len=3  # maksimal 3 item per itemset
        )
        
        if frequent_itemsets.empty:
            return []
        
        # Generate association rules
        rules = association_rules(
            frequent_itemsets, 
            metric="confidence", 
            min_threshold=min_confidence
        )
        
        if rules.empty:
            return []
        
        # Sort by lift (ukuran kekuatan asosiasi)
        rules = rules.sort_values('lift', ascending=False)
        
        # Convert ke list of dict
        results = []
        for _, row in rules.head(10).iterrows():  # ambil top 10 rules
            antecedent = list(row['antecedents'])
            consequent = list(row['consequents'])
            
            results.append({
                'antecedent': antecedent,
                'consequent': consequent,
                'support': round(float(row['support']), 4),
                'confidence': round(float(row['confidence']), 4),
                'lift': round(float(row['lift']), 4)
            })
        
        return results
        
    except Exception as e:
        print(f"Error running Apriori: {e}")
        return []


def generate_insight_text(rule: dict, rule_type: str = 'book') -> str:
    antecedent = ', '.join(rule['antecedent'])
    consequent = ', '.join(rule['consequent'])
    confidence_pct = int(rule['confidence'] * 100)
    
    if rule_type == 'book':
        return f"{confidence_pct}% pelanggan yang membeli \"{antecedent}\" juga membeli \"{consequent}\""
    else:
        return f"{confidence_pct}% pelanggan yang membeli kategori \"{antecedent}\" juga membeli kategori \"{consequent}\""


def generate_bundling_recommendations(
    book_rules: list[dict], 
    category_rules: list[dict]
) -> dict:
    """
    Generate final bundling recommendations dengan insights
    """
    recommendations = {
        'book_bundles': [],
        'category_bundles': [],
        'summary': {
            'total_book_rules': len(book_rules),
            'total_category_rules': len(category_rules)
        }
    }
    
    # Process book rules
    for rule in book_rules[:5]:  # top 5 book bundles
        recommendations['book_bundles'].append({
            'items': rule['antecedent'] + rule['consequent'],
            'antecedent': rule['antecedent'],
            'consequent': rule['consequent'],
            'support': rule['support'],
            'confidence': rule['confidence'],
            'lift': rule['lift'],
            'insight': generate_insight_text(rule, 'book')
        })
    
    # Process category rules
    for rule in category_rules[:5]:  # top 5 category bundles
        recommendations['category_bundles'].append({
            'items': rule['antecedent'] + rule['consequent'],
            'antecedent': rule['antecedent'],
            'consequent': rule['consequent'],
            'support': rule['support'],
            'confidence': rule['confidence'],
            'lift': rule['lift'],
            'insight': generate_insight_text(rule, 'category')
        })
    
    return recommendations