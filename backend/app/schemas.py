from pydantic import BaseModel, Field
class ForecastInput(BaseModel):
    origin_country:str; origin_port:str; destination_country:str; destination_port:str; cargo_type:str
    quantity_tonnes:float=Field(gt=0); vessel_type:str; fuel_price_usd_tonne:float=Field(gt=0); port_congestion:float=Field(ge=0,le=1); month:str
class RegisterIn(BaseModel):
    name:str; email:str; password:str
class LoginIn(BaseModel):
    email:str; password:str
class FeedbackIn(BaseModel): actual_freight_rate:float=Field(gt=0)
