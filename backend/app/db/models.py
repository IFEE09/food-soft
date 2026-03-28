from sqlalchemy import Boolean, Column, Integer, String
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
