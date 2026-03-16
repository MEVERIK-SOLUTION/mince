import io
import json
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc, asc
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.linecharts import HorizontalLineChart
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO
import base64

from ..models.coin import Coin
from ..models.collection import Collection
from ..models.user import User

class ReportService:
    def __init__(self, db: Session):
        self.db = db
        
    def generate_collection_report(
        self,
        collection_id: int,
        report_type: str = "comprehensive",
        date_range: Optional[Tuple[datetime, datetime]] = None,
        include_charts: bool = True,
        include_images: bool = False,
        format_type: str = "pdf"
    ) -> Dict[str, Any]:
        """
        Generuje komplexní report kolekce
        """
        collection = self.db.query(Collection).filter(Collection.id == collection_id).first()
        if not collection:
            raise ValueError("Kolekce nenalezena")
            
        # Základní query pro mince
        query = self.db.query(Coin).filter(Coin.collection_id == collection_id)
        
        if date_range:
            start_date, end_date = date_range
            query = query.filter(
                and_(
                    Coin.acquisition_date >= start_date,
                    Coin.acquisition_date <= end_date
                )
            )
            
        coins = query.all()
        
        # Generování dat podle typu reportu
        if report_type == "comprehensive":
            report_data = self._generate_comprehensive_report(collection, coins)
        elif report_type == "financial":
            report_data = self._generate_financial_report(collection, coins)
        elif report_type == "inventory":
            report_data = self._generate_inventory_report(collection, coins)
        elif report_type == "market_analysis":
            report_data = self._generate_market_analysis_report(collection, coins)
        else:
            raise ValueError(f"Neznámý typ reportu: {report_type}")
            
        # Přidání grafů
        if include_charts:
            report_data["charts"] = self._generate_charts(coins)
            
        # Generování výstupního formátu
        if format_type == "pdf":
            pdf_content = self._generate_pdf_report(report_data, include_images)
            return {
                "content": pdf_content,
                "filename": f"{collection.name}_{report_type}_report_{datetime.now().strftime('%Y%m%d')}.pdf",
                "content_type": "application/pdf"
            }
        elif format_type == "excel":
            excel_content = self._generate_excel_report(report_data)
            return {
                "content": excel_content,
                "filename": f"{collection.name}_{report_type}_report_{datetime.now().strftime('%Y%m%d')}.xlsx",
                "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
        else:
            return {
                "content": report_data,
                "filename": f"{collection.name}_{report_type}_report_{datetime.now().strftime('%Y%m%d')}.json",
                "content_type": "application/json"
            }
    
    def _generate_comprehensive_report(self, collection: Collection, coins: List[Coin]) -> Dict[str, Any]:
        """Generuje komplexní report s všemi dostupnými analýzami"""
        
        # Základní statistiky
        total_coins = len(coins)
        total_value = sum(coin.current_value or 0 for coin in coins)
        total_investment = sum(coin.acquisition_price or 0 for coin in coins)
        profit_loss = total_value - total_investment
        profit_loss_percent = (profit_loss / total_investment * 100) if total_investment > 0 else 0
        
        # Analýza podle zemí
        country_analysis = {}
        for coin in coins:
            country = coin.country
            if country not in country_analysis:
                country_analysis[country] = {
                    "count": 0,
                    "total_value": 0,
                    "avg_value": 0,
                    "oldest_year": float('inf'),
                    "newest_year": 0
                }
            
            country_analysis[country]["count"] += 1
            country_analysis[country]["total_value"] += coin.current_value or 0
            country_analysis[country]["oldest_year"] = min(country_analysis[country]["oldest_year"], coin.year)
            country_analysis[country]["newest_year"] = max(country_analysis[country]["newest_year"], coin.year)
        
        # Výpočet průměrných hodnot
        for country_data in country_analysis.values():
            if country_data["count"] > 0:
                country_data["avg_value"] = country_data["total_value"] / country_data["count"]
                if country_data["oldest_year"] == float('inf'):
                    country_data["oldest_year"] = None
        
        # Analýza podle materiálů
        material_analysis = {}
        for coin in coins:
            material = coin.material
            if material not in material_analysis:
                material_analysis[material] = {
                    "count": 0,
                    "total_value": 0,
                    "avg_value": 0
                }
            
            material_analysis[material]["count"] += 1
            material_analysis[material]["total_value"] += coin.current_value or 0
        
        for material_data in material_analysis.values():
            if material_data["count"] > 0:
                material_data["avg_value"] = material_data["total_value"] / material_data["count"]
        
        # Analýza podle dekád
        decade_analysis = {}
        for coin in coins:
            decade = (coin.year // 10) * 10
            decade_label = f"{decade}s"
            
            if decade_label not in decade_analysis:
                decade_analysis[decade_label] = {
                    "count": 0,
                    "total_value": 0,
                    "avg_value": 0,
                    "decade": decade
                }
            
            decade_analysis[decade_label]["count"] += 1
            decade_analysis[decade_label]["total_value"] += coin.current_value or 0
        
        for decade_data in decade_analysis.values():
            if decade_data["count"] > 0:
                decade_data["avg_value"] = decade_data["total_value"] / decade_data["count"]
        
        # Top 10 nejcennějších mincí
        top_valuable = sorted(
            [coin for coin in coins if coin.current_value],
            key=lambda x: x.current_value,
            reverse=True
        )[:10]
        
        # Analýza stavu mincí
        condition_analysis = {}
        for coin in coins:
            condition = coin.condition
            if condition not in condition_analysis:
                condition_analysis[condition] = {
                    "count": 0,
                    "total_value": 0,
                    "avg_value": 0
                }
            
            condition_analysis[condition]["count"] += 1
            condition_analysis[condition]["total_value"] += coin.current_value or 0
        
        for condition_data in condition_analysis.values():
            if condition_data["count"] > 0:
                condition_data["avg_value"] = condition_data["total_value"] / condition_data["count"]
        
        return {
            "collection_info": {
                "name": collection.name,
                "description": collection.description,
                "created_at": collection.created_at.isoformat(),
                "total_coins": total_coins
            },
            "financial_summary": {
                "total_value": total_value,
                "total_investment": total_investment,
                "profit_loss": profit_loss,
                "profit_loss_percent": profit_loss_percent,
                "average_coin_value": total_value / total_coins if total_coins > 0 else 0
            },
            "country_analysis": country_analysis,
            "material_analysis": material_analysis,
            "decade_analysis": decade_analysis,
            "condition_analysis": condition_analysis,
            "top_valuable_coins": [
                {
                    "name": coin.name,
                    "country": coin.country,
                    "year": coin.year,
                    "current_value": coin.current_value,
                    "condition": coin.condition
                }
                for coin in top_valuable
            ],
            "generated_at": datetime.now().isoformat()
        }
    
    def _generate_financial_report(self, collection: Collection, coins: List[Coin]) -> Dict[str, Any]:
        """Generuje finanční analýzu kolekce"""
        
        # Základní finanční metriky
        coins_with_values = [coin for coin in coins if coin.current_value and coin.acquisition_price]
        
        total_investment = sum(coin.acquisition_price for coin in coins_with_values)
        total_current_value = sum(coin.current_value for coin in coins_with_values)
        total_profit_loss = total_current_value - total_investment
        
        # ROI analýza
        roi_percent = (total_profit_loss / total_investment * 100) if total_investment > 0 else 0
        
        # Analýza podle roků pořízení
        acquisition_analysis = {}
        for coin in coins_with_values:
            if coin.acquisition_date:
                year = coin.acquisition_date.year
                if year not in acquisition_analysis:
                    acquisition_analysis[year] = {
                        "count": 0,
                        "investment": 0,
                        "current_value": 0,
                        "profit_loss": 0,
                        "roi_percent": 0
                    }
                
                acquisition_analysis[year]["count"] += 1
                acquisition_analysis[year]["investment"] += coin.acquisition_price
                acquisition_analysis[year]["current_value"] += coin.current_value
        
        # Výpočet ROI pro každý rok
        for year_data in acquisition_analysis.values():
            year_data["profit_loss"] = year_data["current_value"] - year_data["investment"]
            if year_data["investment"] > 0:
                year_data["roi_percent"] = (year_data["profit_loss"] / year_data["investment"]) * 100
        
        # Top performers (nejvyšší ROI)
        top_performers = sorted(
            coins_with_values,
            key=lambda x: ((x.current_value - x.acquisition_price) / x.acquisition_price) * 100,
            reverse=True
        )[:10]
        
        # Worst performers (nejnižší ROI)
        worst_performers = sorted(
            coins_with_values,
            key=lambda x: ((x.current_value - x.acquisition_price) / x.acquisition_price) * 100
        )[:10]
        
        # Analýza rizika (volatilita hodnot)
        value_changes = []
        for coin in coins_with_values:
            change_percent = ((coin.current_value - coin.acquisition_price) / coin.acquisition_price) * 100
            value_changes.append(change_percent)
        
        volatility = pd.Series(value_changes).std() if value_changes else 0
        
        return {
            "collection_info": {
                "name": collection.name,
                "total_coins_analyzed": len(coins_with_values)
            },
            "financial_overview": {
                "total_investment": total_investment,
                "total_current_value": total_current_value,
                "total_profit_loss": total_profit_loss,
                "roi_percent": roi_percent,
                "volatility": volatility
            },
            "acquisition_analysis": acquisition_analysis,
            "top_performers": [
                {
                    "name": coin.name,
                    "acquisition_price": coin.acquisition_price,
                    "current_value": coin.current_value,
                    "profit_loss": coin.current_value - coin.acquisition_price,
                    "roi_percent": ((coin.current_value - coin.acquisition_price) / coin.acquisition_price) * 100
                }
                for coin in top_performers
            ],
            "worst_performers": [
                {
                    "name": coin.name,
                    "acquisition_price": coin.acquisition_price,
                    "current_value": coin.current_value,
                    "profit_loss": coin.current_value - coin.acquisition_price,
                    "roi_percent": ((coin.current_value - coin.acquisition_price) / coin.acquisition_price) * 100
                }
                for coin in worst_performers
            ],
            "generated_at": datetime.now().isoformat()
        }
    
    def _generate_inventory_report(self, collection: Collection, coins: List[Coin]) -> Dict[str, Any]:
        """Generuje inventární report"""
        
        # Kompletní seznam mincí s detaily
        inventory_list = []
        for coin in coins:
            inventory_list.append({
                "id": coin.id,
                "name": coin.name,
                "country": coin.country,
                "year": coin.year,
                "denomination": coin.denomination,
                "currency": coin.currency,
                "material": coin.material,
                "weight": coin.weight,
                "diameter": coin.diameter,
                "condition": coin.condition,
                "rarity": coin.rarity,
                "current_value": coin.current_value,
                "acquisition_date": coin.acquisition_date.isoformat() if coin.acquisition_date else None,
                "acquisition_price": coin.acquisition_price,
                "notes": coin.notes,
                "is_favorite": coin.is_favorite,
                "is_for_sale": coin.is_for_sale,
                "tags": [tag.name for tag in coin.tags] if coin.tags else []
            })
        
        # Statistiky podle kategorií
        categories_stats = {
            "countries": {},
            "materials": {},
            "conditions": {},
            "rarities": {},
            "decades": {}
        }
        
        for coin in coins:
            # Země
            country = coin.country
            if country not in categories_stats["countries"]:
                categories_stats["countries"][country] = 0
            categories_stats["countries"][country] += 1
            
            # Materiály
            material = coin.material
            if material not in categories_stats["materials"]:
                categories_stats["materials"][material] = 0
            categories_stats["materials"][material] += 1
            
            # Stavy
            condition = coin.condition
            if condition not in categories_stats["conditions"]:
                categories_stats["conditions"][condition] = 0
            categories_stats["conditions"][condition] += 1
            
            # Vzácnost
            rarity = coin.rarity
            if rarity not in categories_stats["rarities"]:
                categories_stats["rarities"][rarity] = 0
            categories_stats["rarities"][rarity] += 1
            
            # Dekády
            decade = f"{(coin.year // 10) * 10}s"
            if decade not in categories_stats["decades"]:
                categories_stats["decades"][decade] = 0
            categories_stats["decades"][decade] += 1
        
        # Mince bez hodnoty (potřebují ocenění)
        coins_without_value = [
            {
                "name": coin.name,
                "country": coin.country,
                "year": coin.year,
                "condition": coin.condition
            }
            for coin in coins if not coin.current_value
        ]
        
        # Oblíbené mince
        favorite_coins = [
            {
                "name": coin.name,
                "country": coin.country,
                "year": coin.year,
                "current_value": coin.current_value
            }
            for coin in coins if coin.is_favorite
        ]
        
        return {
            "collection_info": {
                "name": collection.name,
                "description": collection.description,
                "total_coins": len(coins)
            },
            "inventory_list": inventory_list,
            "categories_statistics": categories_stats,
            "coins_without_value": coins_without_value,
            "favorite_coins": favorite_coins,
            "generated_at": datetime.now().isoformat()
        }
    
    def _generate_market_analysis_report(self, collection: Collection, coins: List[Coin]) -> Dict[str, Any]:
        """Generuje analýzu trhu a trendů"""
        
        # Simulace tržních dat (v reálné aplikaci by se čerpalo z API)
        market_trends = {
            "gold_coins": {"trend": "up", "change_percent": 5.2},
            "silver_coins": {"trend": "stable", "change_percent": 1.1},
            "copper_coins": {"trend": "down", "change_percent": -2.3},
            "rare_coins": {"trend": "up", "change_percent": 8.7}
        }
        
        # Analýza podle materiálů v kontextu trhu
        material_market_analysis = {}
        for coin in coins:
            material = coin.material.lower()
            if material not in material_market_analysis:
                material_market_analysis[material] = {
                    "count": 0,
                    "total_value": 0,
                    "market_trend": "stable",
                    "estimated_change": 0
                }
            
            material_market_analysis[material]["count"] += 1
            material_market_analysis[material]["total_value"] += coin.current_value or 0
            
            # Přiřazení tržního trendu
            if "gold" in material or "zlat" in material:
                material_market_analysis[material]["market_trend"] = market_trends["gold_coins"]["trend"]
                material_market_analysis[material]["estimated_change"] = market_trends["gold_coins"]["change_percent"]
            elif "silver" in material or "stříbr" in material:
                material_market_analysis[material]["market_trend"] = market_trends["silver_coins"]["trend"]
                material_market_analysis[material]["estimated_change"] = market_trends["silver_coins"]["change_percent"]
            elif "copper" in material or "měď" in material:
                material_market_analysis[material]["market_trend"] = market_trends["copper_coins"]["trend"]
                material_market_analysis[material]["estimated_change"] = market_trends["copper_coins"]["change_percent"]
        
        # Doporučení pro investice
        investment_recommendations = []
        
        # Doporučení na základě trendů
        for material, data in material_market_analysis.items():
            if data["estimated_change"] > 3:
                investment_recommendations.append({
                    "type": "hold",
                    "category": material,
                    "reason": f"Pozitivní trend (+{data['estimated_change']}%)",
                    "priority": "high"
                })
            elif data["estimated_change"] < -3:
                investment_recommendations.append({
                    "type": "consider_selling",
                    "category": material,
                    "reason": f"Negativní trend ({data['estimated_change']}%)",
                    "priority": "medium"
                })
        
        # Analýza vzácných mincí
        rare_coins_analysis = {}
        for coin in coins:
            if coin.rarity in ["Rare", "Very Rare", "Extremely Rare"]:
                rarity = coin.rarity
                if rarity not in rare_coins_analysis:
                    rare_coins_analysis[rarity] = {
                        "count": 0,
                        "total_value": 0,
                        "avg_value": 0
                    }
                
                rare_coins_analysis[rarity]["count"] += 1
                rare_coins_analysis[rarity]["total_value"] += coin.current_value or 0
        
        for rarity_data in rare_coins_analysis.values():
            if rarity_data["count"] > 0:
                rarity_data["avg_value"] = rarity_data["total_value"] / rarity_data["count"]
        
        return {
            "collection_info": {
                "name": collection.name,
                "analysis_date": datetime.now().isoformat()
            },
            "market_trends": market_trends,
            "material_market_analysis": material_market_analysis,
            "rare_coins_analysis": rare_coins_analysis,
            "investment_recommendations": investment_recommendations,
            "generated_at": datetime.now().isoformat()
        }
    
    def _generate_charts(self, coins: List[Coin]) -> Dict[str, str]:
        """Generuje grafy jako base64 encoded obrázky"""
        charts = {}
        
        # Graf rozdělení podle zemí
        country_counts = {}
        for coin in coins:
            country = coin.country
            country_counts[country] = country_counts.get(country, 0) + 1
        
        if country_counts:
            plt.figure(figsize=(10, 6))
            countries = list(country_counts.keys())[:10]  # Top 10
            counts = [country_counts[country] for country in countries]
            
            plt.bar(countries, counts)
            plt.title('Rozdělení mincí podle zemí (Top 10)')
            plt.xlabel('Země')
            plt.ylabel('Počet mincí')
            plt.xticks(rotation=45)
            plt.tight_layout()
            
            buffer = BytesIO()
            plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight')
            buffer.seek(0)
            charts['countries_distribution'] = base64.b64encode(buffer.getvalue()).decode()
            plt.close()
        
        # Graf hodnot podle dekád
        decade_values = {}
        for coin in coins:
            if coin.current_value:
                decade = f"{(coin.year // 10) * 10}s"
                if decade not in decade_values:
                    decade_values[decade] = []
                decade_values[decade].append(coin.current_value)
        
        if decade_values:
            plt.figure(figsize=(12, 6))
            decades = sorted(decade_values.keys())
            avg_values = [sum(decade_values[decade]) / len(decade_values[decade]) for decade in decades]
            
            plt.plot(decades, avg_values, marker='o', linewidth=2, markersize=8)
            plt.title('Průměrná hodnota mincí podle dekád')
            plt.xlabel('Dekáda')
            plt.ylabel('Průměrná hodnota (CZK)')
            plt.xticks(rotation=45)
            plt.grid(True, alpha=0.3)
            plt.tight_layout()
            
            buffer = BytesIO()
            plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight')
            buffer.seek(0)
            charts['value_by_decade'] = base64.b64encode(buffer.getvalue()).decode()
            plt.close()
        
        return charts
    
    def _generate_pdf_report(self, report_data: Dict[str, Any], include_images: bool = False) -> bytes:
        """Generuje PDF report"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        # Nadpis
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=1  # Center
        )
        
        story.append(Paragraph(f"Report kolekce: {report_data['collection_info']['name']}", title_style))
        story.append(Spacer(1, 20))
        
        # Finanční přehled
        if 'financial_summary' in report_data:
            story.append(Paragraph("Finanční přehled", styles['Heading2']))
            
            financial_data = [
                ['Metrika', 'Hodnota'],
                ['Celková hodnota', f"{report_data['financial_summary']['total_value']:,.2f} CZK"],
                ['Celková investice', f"{report_data['financial_summary']['total_investment']:,.2f} CZK"],
                ['Zisk/Ztráta', f"{report_data['financial_summary']['profit_loss']:,.2f} CZK"],
                ['ROI', f"{report_data['financial_summary']['profit_loss_percent']:.2f}%"],
                ['Průměrná hodnota mince', f"{report_data['financial_summary']['average_coin_value']:,.2f} CZK"]
            ]
            
            financial_table = Table(financial_data)
            financial_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 14),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            story.append(financial_table)
            story.append(Spacer(1, 20))
        
        # Top cenné mince
        if 'top_valuable_coins' in report_data:
            story.append(Paragraph("Top 10 nejcennějších mincí", styles['Heading2']))
            
            valuable_data = [['Název', 'Země', 'Rok', 'Hodnota', 'Stav']]
            for coin in report_data['top_valuable_coins']:
                valuable_data.append([
                    coin['name'],
                    coin['country'],
                    str(coin['year']),
                    f"{coin['current_value']:,.2f} CZK",
                    coin['condition']
                ])
            
            valuable_table = Table(valuable_data)
            valuable_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            story.append(valuable_table)
            story.append(Spacer(1, 20))
        
        # Analýza podle zemí
        if 'country_analysis' in report_data:
            story.append(Paragraph("Analýza podle zemí", styles['Heading2']))
            
            country_data = [['Země', 'Počet', 'Celková hodnota', 'Průměrná hodnota']]
            for country, data in report_data['country_analysis'].items():
                country_data.append([
                    country,
                    str(data['count']),
                    f"{data['total_value']:,.2f} CZK",
                    f"{data['avg_value']:,.2f} CZK"
                ])
            
            country_table = Table(country_data)
            country_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            story.append(country_table)
        
        # Generování PDF
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
    
    def _generate_excel_report(self, report_data: Dict[str, Any]) -> bytes:
        """Generuje Excel report s více listy"""
        buffer = BytesIO()
        
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            # Přehled kolekce
            if 'collection_info' in report_data:
                overview_data = {
                    'Informace': ['Název kolekce', 'Celkem mincí', 'Datum generování'],
                    'Hodnota': [
                        report_data['collection_info']['name'],
                        report_data['collection_info'].get('total_coins', 0),
                        report_data['generated_at']
                    ]
                }
                pd.DataFrame(overview_data).to_excel(writer, sheet_name='Přehled', index=False)
            
            # Finanční přehled
            if 'financial_summary' in report_data:
                financial_df = pd.DataFrame([report_data['financial_summary']])
                financial_df.to_excel(writer, sheet_name='Finanční přehled', index=False)
            
            # Analýza podle zemí
            if 'country_analysis' in report_data:
                country_df = pd.DataFrame.from_dict(report_data['country_analysis'], orient='index')
                country_df.reset_index(inplace=True)
                country_df.rename(columns={'index': 'Země'}, inplace=True)
                country_df.to_excel(writer, sheet_name='Analýza zemí', index=False)
            
            # Top cenné mince
            if 'top_valuable_coins' in report_data:
                valuable_df = pd.DataFrame(report_data['top_valuable_coins'])
                valuable_df.to_excel(writer, sheet_name='Top cenné mince', index=False)
            
            # Inventář (pokud existuje)
            if 'inventory_list' in report_data:
                inventory_df = pd.DataFrame(report_data['inventory_list'])
                inventory_df.to_excel(writer, sheet_name='Inventář', index=False)
        
        buffer.seek(0)
        return buffer.getvalue()
    
    def generate_comparison_report(
        self,
        collection_ids: List[int],
        comparison_type: str = "basic"
    ) -> Dict[str, Any]:
        """Generuje srovnávací report mezi kolekcemi"""
        
        collections_data = []
        
        for collection_id in collection_ids:
            collection = self.db.query(Collection).filter(Collection.id == collection_id).first()
            if not collection:
                continue
                
            coins = self.db.query(Coin).filter(Coin.collection_id == collection_id).all()
            
            collection_stats = {
                "id": collection.id,
                "name": collection.name,
                "total_coins": len(coins),
                "total_value": sum(coin.current_value or 0 for coin in coins),
                "total_investment": sum(coin.acquisition_price or 0 for coin in coins),
                "countries_count": len(set(coin.country for coin in coins)),
                "materials_count": len(set(coin.material for coin in coins)),
                "avg_coin_value": sum(coin.current_value or 0 for coin in coins) / len(coins) if coins else 0,
                "oldest_coin_year": min(coin.year for coin in coins) if coins else None,
                "newest_coin_year": max(coin.year for coin in coins) if coins else None
            }
            
            # ROI výpočet
            if collection_stats["total_investment"] > 0:
                collection_stats["roi_percent"] = (
                    (collection_stats["total_value"] - collection_stats["total_investment"]) 
                    / collection_stats["total_investment"] * 100
                )
            else:
                collection_stats["roi_percent"] = 0
            
            collections_data.append(collection_stats)
        
        # Srovnávací metriky
        if collections_data:
            comparison_metrics = {
                "best_roi": max(collections_data, key=lambda x: x["roi_percent"]),
                "highest_value": max(collections_data, key=lambda x: x["total_value"]),
                "largest_collection": max(collections_data, key=lambda x: x["total_coins"]),
                "most_diverse": max(collections_data, key=lambda x: x["countries_count"]),
                "highest_avg_value": max(collections_data, key=lambda x: x["avg_coin_value"])
            }
        else:
            comparison_metrics = {}
        
        return {
            "collections_data": collections_data,
            "comparison_metrics": comparison_metrics,
            "generated_at": datetime.now().isoformat()
        }
    
    def generate_trend_analysis(
        self,
        collection_id: int,
        period_months: int = 12
    ) -> Dict[str, Any]:
        """Generuje analýzu trendů za určité období"""
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=period_months * 30)
        
        # Získání dat o pořízení mincí v čase
        coins = self.db.query(Coin).filter(
            and_(
                Coin.collection_id == collection_id,
                Coin.acquisition_date >= start_date,
                Coin.acquisition_date <= end_date
            )
        ).order_by(Coin.acquisition_date).all()
        
        # Analýza podle měsíců
        monthly_data = {}
        cumulative_value = 0
        cumulative_investment = 0
        
        for coin in coins:
            if coin.acquisition_date:
                month_key = coin.acquisition_date.strftime('%Y-%m')
                
                if month_key not in monthly_data:
                    monthly_data[month_key] = {
                        "coins_acquired": 0,
                        "investment": 0,
                        "current_value": 0,
                        "cumulative_coins": 0,
                        "cumulative_investment": 0,
                        "cumulative_value": 0
                    }
                
                monthly_data[month_key]["coins_acquired"] += 1
                monthly_data[month_key]["investment"] += coin.acquisition_price or 0
                monthly_data[month_key]["current_value"] += coin.current_value or 0
                
                cumulative_investment += coin.acquisition_price or 0
                cumulative_value += coin.current_value or 0
                
                monthly_data[month_key]["cumulative_investment"] = cumulative_investment
                monthly_data[month_key]["cumulative_value"] = cumulative_value
                monthly_data[month_key]["cumulative_coins"] = sum(
                    data["coins_acquired"] for data in monthly_data.values()
                )
        
        # Výpočet trendů
        months = sorted(monthly_data.keys())
        if len(months) >= 2:
            # Trend počtu mincí
            coin_counts = [monthly_data[month]["coins_acquired"] for month in months]
            coin_trend = "increasing" if coin_counts[-1] > coin_counts[0] else "decreasing"
            
            # Trend investic
            investments = [monthly_data[month]["investment"] for month in months]
            investment_trend = "increasing" if investments[-1] > investments[0] else "decreasing"
        else:
            coin_trend = "stable"
            investment_trend = "stable"
        
        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "months": period_months
            },
            "monthly_data": monthly_data,
            "trends": {
                "coin_acquisition": coin_trend,
                "investment": investment_trend
            },
            "summary": {
                "total_coins_acquired": len(coins),
                "total_investment": sum(coin.acquisition_price or 0 for coin in coins),
                "total_current_value": sum(coin.current_value or 0 for coin in coins)
            },
            "generated_at": datetime.now().isoformat()
        }