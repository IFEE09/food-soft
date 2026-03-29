from sqlalchemy import Boolean, Column, Integer, String, Float
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
