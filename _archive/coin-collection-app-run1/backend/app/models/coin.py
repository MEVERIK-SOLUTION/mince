from sqlalchemy import Column, Integer, String, Text, DECIMAL, Date, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class Coin(Base):
    """Model pro základní informace o mincích"""
    __tablename__ = "coins"
    
    id = Column(Integer, primary_key=True, index=True)
    catalog_id = Column(String(50), unique=True, index=True)  # např. "CZ-1993-10CZK-001"
    name = Column(String(200), nullable=False, index=True)
    country = Column(String(100), nullable=False, index=True)
    year_minted = Column(Integer, index=True)
    year_range = Column(String(20))  # pro rozsahy typu "1993-1995"
    denomination = Column(DECIMAL(10, 2))
    currency = Column(String(10), index=True)
    
    # Fyzické vlastnosti
    material = Column(String(100), index=True)  # "stříbro 925", "bronz", "bimetalická"
    weight_grams = Column(DECIMAL(8, 3))
    diameter_mm = Column(DECIMAL(6, 2))
    thickness_mm = Column(DECIMAL(5, 2))
    edge_type = Column(String(50))  # "hladký", "rýhovaný", "nápis"
    
    # Kategorizace
    coin_type = Column(String(50), index=True)  # "oběžná", "pamětní", "investiční", "antická"
    series = Column(String(100), index=True)  # "Hrady", "Osobnosti", "Olympiáda"
    rarity_level = Column(Integer)  # 1-10 škála vzácnosti
    
    # Metadata jako JSON
    metadata = Column(JSON)  # flexibilní data specifická pro typ mince
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    images = relationship("CoinImage", back_populates="coin", cascade="all, delete-orphan")
    collections = relationship("UserCollection", back_populates="coin")
    price_history = relationship("PriceHistory", back_populates="coin")
    auction_results = relationship("AuctionResult", back_populates="coin")
    
    def __repr__(self):
        return f"<Coin(id={self.id}, name='{self.name}', country='{self.country}', year={self.year_minted})>"


class CoinImage(Base):
    """Model pro obrázky mincí"""
    __tablename__ = "coin_images"
    
    id = Column(Integer, primary_key=True, index=True)
    coin_id = Column(Integer, ForeignKey("coins.id", ondelete="CASCADE"), nullable=False)
    image_type = Column(String(20), nullable=False)  # "obverse", "reverse", "edge", "detail"
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
    is_primary = Column(Boolean, default=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    coin = relationship("Coin", back_populates="images")
    
    def __repr__(self):
        return f"<CoinImage(id={self.id}, coin_id={self.coin_id}, type='{self.image_type}')>"


class UserCollection(Base):
    """Model pro uživatelské kolekce"""
    __tablename__ = "user_collections"
    
    id = Column(Integer, primary_key=True, index=True)
    coin_id = Column(Integer, ForeignKey("coins.id"), nullable=False)
    user_id = Column(Integer)  # pro budoucí multi-user funkcionalitu
    
    # Stav konkrétního exempláře
    condition_grade = Column(String(20))  # "UNC", "XF", "VF", "F", "VG"
    condition_notes = Column(Text)
    acquisition_date = Column(Date)
    acquisition_price = Column(DECIMAL(10, 2))
    acquisition_source = Column(String(100))  # "aukce", "obchod", "dědictví"
    
    # Aktuální hodnota
    current_estimated_value = Column(DECIMAL(10, 2))
    last_valuation_date = Column(Date)
    valuation_source = Column(String(100))
    
    # Lokace a poznámky
    storage_location = Column(String(100))
    insurance_value = Column(DECIMAL(10, 2))
    notes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    coin = relationship("Coin", back_populates="collections")
    
    def __repr__(self):
        return f"<UserCollection(id={self.id}, coin_id={self.coin_id}, condition='{self.condition_grade}')>"


class PriceHistory(Base):
    """Model pro cenové historie z různých zdrojů"""
    __tablename__ = "price_history"
    
    id = Column(Integer, primary_key=True, index=True)
    coin_id = Column(Integer, ForeignKey("coins.id"), nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False)
    currency = Column(String(10), nullable=False)
    condition_grade = Column(String(20))
    source = Column(String(100), nullable=False)  # "numista", "aukce_aurea", "pcgs"
    source_url = Column(String(500))
    recorded_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    coin = relationship("Coin", back_populates="price_history")
    
    def __repr__(self):
        return f"<PriceHistory(id={self.id}, coin_id={self.coin_id}, price={self.price}, source='{self.source}')>"


class AuctionResult(Base):
    """Model pro aukční výsledky"""
    __tablename__ = "auction_results"
    
    id = Column(Integer, primary_key=True, index=True)
    coin_id = Column(Integer, ForeignKey("coins.id"), nullable=False)
    auction_house = Column(String(100), nullable=False)
    auction_date = Column(Date, nullable=False)
    lot_number = Column(String(50))
    hammer_price = Column(DECIMAL(10, 2), nullable=False)
    estimate_low = Column(DECIMAL(10, 2))
    estimate_high = Column(DECIMAL(10, 2))
    condition_grade = Column(String(20))
    description = Column(Text)
    source_url = Column(String(500))
    
    # Relationship
    coin = relationship("Coin", back_populates="auction_results")
    
    def __repr__(self):
        return f"<AuctionResult(id={self.id}, coin_id={self.coin_id}, price={self.hammer_price}, auction='{self.auction_house}')>"