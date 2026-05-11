# -*- coding: utf-8 -*-

# Análisis de negocio y Feature Engineering (RFM)

import pandas as pd
import numpy as np

class BusinessAnalyzer:
    def __init__(self, df):
        # Aseguramos copia propia para evitar SettingWithCopyWarning
        self.df = df.copy()
        self.df.loc[:, 'date'] = pd.to_datetime(self.df['date'], errors='coerce')
        self.df = self.df.dropna(subset=['date'])
        self.df.loc[:, 'year_month'] = self.df['date'].dt.to_period('M')

    def get_kpis(self):
        total_sales  = self.df['total_sales'].sum()
        total_profit = self.df['profit'].sum()
        margin       = (total_profit / total_sales * 100) if total_sales > 0 else 0
        monthly      = self.df.groupby('year_month')['total_sales'].sum()
        mom          = monthly.pct_change().mean() * 100
        n_customers  = self.df['customer_id'].nunique()
        n_orders     = len(self.df)
        avg_order    = total_sales / n_orders if n_orders > 0 else 0
        
        kpis = {
            'Ventas Totales':       float(total_sales) if pd.notna(total_sales) else 0,
            'Beneficio Total':      float(total_profit) if pd.notna(total_profit) else 0,
            'Margen %':             float(margin) if pd.notna(margin) else 0,
            'Crecimiento MoM %':    float(mom) if pd.notna(mom) else 0,
            'Clientes Únicos':      int(n_customers),
            'Pedidos Totales':      int(n_orders),
            'Ticket Medio':         float(avg_order) if pd.notna(avg_order) else 0
        }
        return kpis

    def get_category_analysis(self):
        # Enriquecemos el análisis de categorías con margen y conteo de transacciones
        analysis = self.df.groupby('product_category')[['total_sales', 'profit']].sum()
        analysis['margin_pct'] = (analysis['profit'] / analysis['total_sales'] * 100).round(2).fillna(0)
        analysis['order_count'] = self.df.groupby('product_category')['customer_id'].count()
        return analysis

    def get_top_products(self, top_n=20):
        """Top products by total sales volume and order count for inventory analysis"""
        if 'product_name' not in self.df.columns:
            fallback = self.df.groupby('product_category')['total_sales'].agg(['count', 'sum']).reset_index()
            fallback.columns = ['product_category', 'order_count', 'total_sales']
            fallback['product_name'] = 'N/A (Category)'
            fallback['avg_sale'] = fallback['total_sales'] / fallback['order_count'].replace(0, 1)
            fallback['total_profit'] = fallback['total_sales'] * 0.15  # Simulated profit
            fallback['margin_pct'] = 15.0
            fallback = fallback.sort_values('total_sales', ascending=False)
            fallback['cum_sales_pct'] = (fallback['total_sales'].cumsum() / fallback['total_sales'].sum() * 100).fillna(0)
            fallback['abc_class'] = pd.cut(fallback['cum_sales_pct'], bins=[0, 70, 90, 101], labels=['A', 'B', 'C'], include_lowest=True).astype(str)
            return fallback.sort_values('total_sales', ascending=False).head(top_n)
        
        top_prods = (self.df.groupby(['product_category', 'product_name'])
                    .agg({
                        'total_sales': ['count', 'sum', 'mean'],
                        'profit': 'sum'
                    })
                    .round(2)
                    .reset_index())
        top_prods.columns = ['product_category', 'product_name', 'order_count', 'total_sales', 'avg_sale', 'total_profit']

        if not top_prods.empty:
            # Calcular Margen Porcentual
            top_prods['margin_pct'] = (top_prods['total_profit'] / top_prods['total_sales'] * 100).round(2)
            
            # Lógica de Status mejorada para visualización
            q_high = top_prods['total_sales'].quantile(0.7)
            q_low = top_prods['total_sales'].quantile(0.3)
            
            def get_status(sales):
                if sales >= q_high: return 'Star'          
                if sales <= q_low:  return 'Underperformer' 
                return 'Stable'                           
            
            top_prods['status'] = top_prods['total_sales'].apply(get_status)
            
            # Identificar Productos de Riesgo, que consisten en que tienen mucho volumen pero poco margen
            top_prods['is_critical'] = (top_prods['total_sales'] > q_high) & (top_prods['margin_pct'] < 5)
            
            # Clasificación ABC: A (Top 70% ventas), B (Siguiente 20%), C (Resto 10%)
            # Esta métrica es fundamental para la gestión de stocks y priorización
            top_prods = top_prods.sort_values('total_sales', ascending=False)
            top_prods['cum_sales_pct'] = (top_prods['total_sales'].cumsum() / top_prods['total_sales'].sum() * 100).fillna(0)
            top_prods['abc_class'] = pd.cut(top_prods['cum_sales_pct'], 
                                            bins=[0, 70, 90, 101], 
                                            labels=['A', 'B', 'C'], 
                                            include_lowest=True).astype(str)

        # Ordenar por categoría y luego por ventas
        top_prods = top_prods.sort_values(['product_category', 'total_sales'], ascending=[True, False])

        return top_prods.head(top_n)

    def get_monthly_sales(self):
        monthly = (self.df.groupby(self.df['date'].dt.to_period('M'))
                   .agg(total_sales=('total_sales', 'sum'),
                        total_profit=('profit', 'sum'),
                        n_transactions=('customer_id', 'count'))
                   .reset_index())
        monthly['date'] = monthly['date'].dt.to_timestamp()
        return monthly.sort_values('date')

    def get_region_analysis(self):
        if 'region' not in self.df.columns:
            return pd.DataFrame()
        return (self.df.groupby('region')[['total_sales', 'profit']]
                .sum().round(2).reset_index())

def _category_analysis(df: pd.DataFrame) -> pd.DataFrame:
    if "product_category" not in df.columns:
        return pd.DataFrame()
    return (df.groupby("product_category")[["total_sales", "profit"]]
            .agg(["sum", "mean", "count"])
            .round(2)
            .reset_index())


def _region_analysis(df: pd.DataFrame) -> pd.DataFrame:
    if "region" not in df.columns:
        return pd.DataFrame()
    return (df.groupby("region")[["total_sales", "profit"]]
            .sum()
            .round(2)
            .reset_index())

def _monthly_sales(df: pd.DataFrame) -> pd.DataFrame:
    monthly = (df.groupby(df["date"].dt.to_period("M"))
               .agg(total_sales=("total_sales", "sum"),
                    total_profit=("profit", "sum"),
                    n_transactions=("customer_id", "count"))
               .reset_index())
    monthly["date"] = monthly["date"].dt.to_timestamp()
    return monthly.sort_values("date")

def data_engineering_pipeline(df):
    snapshot_date = df['date'].max() + pd.Timedelta(days=1)

    cat_cols = [c for c in df.columns if c.startswith('cat_')]
    agg_dict = {
        'date': lambda x: (snapshot_date - x.max()).days,
        'customer_id': 'count',
        'total_sales': 'sum',
        'profit': 'sum',
    }
    for col in cat_cols:
        agg_dict[col] = 'sum'

    rfm = df.groupby('customer_id').agg(agg_dict).rename(
        columns={
            'date': 'Recency',
            'customer_id': 'Frequency',
            'total_sales': 'Monetary',
            'profit': 'Total_Profit',
        }
    )

    numeric_cols = ['Recency', 'Frequency', 'Monetary']
    for col in numeric_cols:
        if col in rfm.columns:
            rfm[col] = pd.to_numeric(rfm[col], errors='coerce').fillna(0)

    rfm['Recency_log']   = np.log1p(rfm['Recency'])
    rfm['Frequency_log'] = np.log1p(rfm['Frequency'])
    rfm['Monetary_log']  = np.log1p(rfm['Monetary'])
    threshold = rfm['Recency'].quantile(0.8)
    rfm['Churn'] = (rfm['Recency'] > threshold).astype(int)

    return rfm