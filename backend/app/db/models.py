from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    # Role can be 'owner' or 'cook'
    role = Column(String, default="cook", nullable=False)
    is_active = Column(Boolean(), default=True)

class Supply(Base):
    __tablename__ = "supplies"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    quantity = Column(Float, default=0.0)
    unit = Column(String, default="pz") # kg, liters, pz
    min_quantity = Column(Float, default=5.0) # threshold for alerts
    category = Column(String, index=True, nullable=True) # Proteins, Veggies, etc.

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String, index=True, nullable=True)
    total = Column(Float, default=0.0)
    status = Column(String, default="pending") # pending, ready, delivered
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ready_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    
    items = relationship("OrderItem", back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_name = Column(String, nullable=False)
    quantity = Column(Integer, default=1)
    
    order = relationship("Order", back_populates="items")
