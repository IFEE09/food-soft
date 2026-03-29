from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    api_key = Column(String, unique=True, index=True, nullable=True) # For Robot/External integration
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    # Role can be 'owner' or 'cook'
    role = Column(String, default="cook", nullable=False)
    is_active = Column(Boolean(), default=True)
    
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    organization = relationship("Organization")

class Supply(Base):
    __tablename__ = "supplies"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    quantity = Column(Float, default=0.0)
    unit = Column(String, default="pz") # kg, liters, pz
    cost = Column(Float, default=0.0) # Cost per unit
    min_quantity = Column(Float, default=5.0) # threshold for alerts
    category = Column(String, index=True, nullable=True) # Proteins, Veggies, etc.
    
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)

class Kitchen(Base):
    __tablename__ = "kitchens"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    is_active = Column(Boolean(), default=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    
    orders = relationship("Order", back_populates="kitchen")

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String, index=True, nullable=True)
    total = Column(Float, default=0.0)
    status = Column(String, default="pending") # pending, ready, delivered
    
    kitchen_id = Column(Integer, ForeignKey("kitchens.id"), nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ready_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    
    items = relationship("OrderItem", back_populates="order")
    kitchen = relationship("Kitchen", back_populates="orders")

class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_name = Column(String, nullable=False)
    quantity = Column(Integer, default=1)
    
    order = relationship("Order", back_populates="items")

class MenuItem(Base):
    __tablename__ = "menu_items"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    price = Column(Float, default=0.0)
    category = Column(String, index=True, nullable=True)
    description = Column(String, nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    
    recipe_items = relationship("MenuItemRecipe", back_populates="menu_item", cascade="all, delete-orphan")

class MenuItemRecipe(Base):
    __tablename__ = "menu_item_recipes"
    
    id = Column(Integer, primary_key=True, index=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"))
    supply_id = Column(Integer, ForeignKey("supplies.id"))
    quantity = Column(Float, default=1.0) # Quantity of supply needed
    
    menu_item = relationship("MenuItem", back_populates="recipe_items")
    supply = relationship("Supply")
