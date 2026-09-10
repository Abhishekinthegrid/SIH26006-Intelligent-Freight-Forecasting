
# SIH26006 – Intelligent Freight Forecasting

## Freight Intelligence

**Team:** GridWalkers

**SIH Problem Statement:**  
Development of an Intelligent Freight Forecasting Model for Optimized Vessel Chartering and Bulk Cargo Procurement from overseas to East Coast of India.

---

## 1. Problem Statement

Bulk cargo transportation from overseas to the East Coast of India involves complex decisions related to freight rates, vessel selection, cargo quantity, fuel prices, port congestion, and maritime routes.

Traditional freight planning can rely heavily on manual estimation and historical information, making it difficult to determine suitable freight rates and vessel options for changing market and shipment conditions.

To address this challenge, **Freight Intelligence** provides an AI-powered decision-support system that forecasts freight rates and evaluates maritime transportation routes using shipment and market-related parameters.

The system aims to help users make more informed decisions related to:

- Freight rate estimation
- Vessel chartering
- Bulk cargo procurement
- Maritime route evaluation
- Shipment cost planning

---

# 2. Solution Overview

**Freight Intelligence** combines machine learning and maritime routing into a single web-based platform.

The user provides shipment information such as:

- Origin country
- Origin port
- Destination country
- Destination port
- Cargo type
- Quantity in tonnes
- Vessel type
- Fuel price
- Port congestion
- Month

The system processes these inputs through the backend and provides:

- Predicted freight rate
- Estimated total cost
- Recommended vessel
- Maritime route
- Route distance
- Map visualization
- Freight planning insights

---

# 3. System Architecture

The system follows a frontend-backend-machine-learning architecture.

```text
                    ┌─────────────────────────┐
                    │      React Frontend     │
                    │        Vite + JS        │
                    │        Deployed on      │
                    │         Vercel          │
                    └────────────┬────────────┘
                                 │
                                 │ HTTPS REST API
                                 ▼
                    ┌─────────────────────────┐
                    │        FastAPI          │
                    │        Backend          │
                    │       Python API        │
                    │      Deployed on        │
                    │         Render          │
                    └───────────┬─────────────┘
                                │
                    ┌───────────┴────────────┐
                    │                        │
                    ▼                        ▼
          ┌──────────────────┐     ┌──────────────────┐
          │  CatBoost Model  │     │  SeaRoute Engine │
          │ Freight Forecast │     │ Maritime Routing │
          └────────┬─────────┘     └────────┬─────────┘
                   │                        │
                   └────────────┬───────────┘
                                ▼
                    ┌─────────────────────────┐
                    │    Decision Results     │
                    │                         │
                    │ Freight Rate            │
                    │ Total Cost              │
                    │ Vessel Recommendation   │
                    │ Route Distance           │
                    │ Maritime Route          │
                    └─────────────────────────┘
4. Technology Stack
Component
Technology
Frontend
React
Build Tool
Vite
Frontend Language
JavaScript / JSX
Map Visualization
Leaflet
Backend
Python
API Framework
FastAPI
Machine Learning
CatBoost
Maritime Routing
SeaRoute
Frontend Deployment
Vercel
Backend Deployment
Render
Training Dataset
CSV
Model Format
CatBoost .cbm
5. Project Architecture
The application is divided into two major parts:
SIH26006-Intelligent-Freight-Forecasting/
│
├── backend/
│
└── frontend/
Backend
The backend contains:
FastAPI API
CatBoost model
Machine-learning prediction logic
Maritime routing logic
Port information
API schemas
Training dataset
Trained model
Frontend
The frontend contains:
React application
Forecasting interface
Shipment input forms
Results dashboard
Maritime map
Vessel visualizations
API communication
6. Backend Architecture
backend/
│
├── app/
│   ├── ml/
│   │   ├── train_model.py
│   │   └── predictor.py
│   │
│   ├── main.py
│   ├── ports.py
│   ├── routing.py
│   ├── routing_grid.py
│   ├── routing_searoute_legacy.py
│   ├── schemas.py
│   └── db.py
│
├── data/
│   ├── maritime_ai_training_1m.csv
│   ├── landmask.geojson
│   └── README.txt
│
├── models/
│   ├── freight_model.cbm
│   └── model_meta.json
│
├── requirements.txt
└── .env.example
7. Machine Learning Architecture
The project uses a CatBoost regression model to forecast freight rates.
The training pipeline is:
maritime_ai_training_1m.csv
            │
            ▼
     train_model.py
            │
            ▼
     CatBoost Regression
            │
            ├───────────────┐
            ▼               ▼
 freight_model.cbm    model_meta.json
            │
            ▼
       predictor.py
            │
            ▼
       FastAPI API
            │
            ▼
      React Frontend
The primary training dataset contains approximately 1,000,000 records.
The prediction target is:
freight_rate_usd_tonne
Important input features include:
Origin country
Origin port
Destination country
Destination port
Cargo type
Quantity
Vessel type
Fuel price
Port congestion
Month
8. Maritime Routing Architecture
The application uses SeaRoute to calculate maritime routes between selected ports.
Origin Port
     │
     │
Destination Port
     │
     ▼
  FastAPI
     │
     ▼
 routing.py
     │
     ▼
 SeaRoute
     │
     ▼
Maritime Route
     │
     ├── Route Coordinates
     └── Route Distance
              │
              ▼
       Leaflet Map
The routing system is designed to use maritime paths rather than simply drawing a straight line between two ports.
The project also contains:
backend/data/landmask.geojson
for geographic route validation.
9. FastAPI Backend
FastAPI provides the communication layer between the React frontend and the Python backend.
The main API endpoints include:
Health Check
GET /health
Checks whether the backend and model are available.
Metadata
GET /api/metadata
Provides model/application metadata.
Freight Prediction
POST /api/predict
Receives shipment information and returns the freight forecasting result.
Maritime Route
POST /api/route
Calculates the maritime route between the selected ports.
10. Frontend Workflow
User
 │
 ▼
Select Origin & Destination
 │
 ▼
Enter Cargo & Shipment Details
 │
 ▼
React Frontend
 │
 ▼
FastAPI Backend
 │
 ├───────────────┐
 ▼               ▼
CatBoost       SeaRoute
 │               │
 ▼               ▼
Freight        Maritime
Forecast       Route
 │               │
 └───────┬───────┘
         ▼
   Results Dashboard
         │
         ▼
   Map Visualization
11. Dataset
The primary dataset is:
backend/data/maritime_ai_training_1m.csv
It contains approximately 1,000,000 records related to maritime freight forecasting.
Important dataset fields include:
origin_country
origin_port
destination_country
destination_port
cargo_type
quantity_tonnes
vessel_type
fuel_price_usd_tonne
port_congestion
month
freight_rate_usd_tonne
The target variable is:
freight_rate_usd_tonne
The large dataset is managed using Git LFS.
12. Vessel Types
The application supports multiple bulk-carrier vessel categories:
Handysize
Handymax
Supramax
Ultramax
Panamax
Kamsarmax
Post-Panamax
Capesize
Newcastlemax
VLOC
13. Local Installation
Prerequisites
Install the following:
Python
Node.js
npm
Git
Git LFS
14. Backend Setup
Open a terminal inside the backend directory.
Create a Python virtual environment:
python -m venv venv
Activate it on Windows:
venv\Scripts\activate
Install the required dependencies:
pip install -r requirements.txt
Start the FastAPI server:
uvicorn app.main:app --reload
The backend will normally be available at:
http://127.0.0.1:8000
Health check:
http://127.0.0.1:8000/health
15. Frontend Setup
Open another terminal inside the frontend directory.
Install dependencies:
npm install
Start the development server:
npm run dev
The frontend will normally be available at:
http://localhost:5173
16. Frontend Environment Configuration
Create/configure the frontend environment variable:
VITE_API_URL
For the deployed backend:
VITE_API_URL=https://sih26006-backend.onrender.com
The frontend uses this URL to communicate with the FastAPI backend.
17. Model Training
The model-training code is located at:
backend/app/ml/train_model.py
The training process reads the maritime training dataset and produces:
backend/models/freight_model.cbm
and:
backend/models/model_meta.json
The trained model is then loaded by:
backend/app/ml/predictor.py
for live freight prediction.
18. Production Deployment
Frontend
The React frontend is deployed on Vercel.
Production frontend:
https://sih-26006-intelligent-freight-forecasting-4lypplwz1.vercel.app
Backend
The FastAPI backend is deployed on Render.
Production backend:
https://sih26006-backend.onrender.com
The frontend communicates with the backend using HTTPS REST APIs.
19. Security
The application uses basic production security practices including:
HTTPS communication
CORS-based origin restriction
Environment-based configuration
Backend-side ML model isolation
No direct model transfer to the frontend
The trained model remains on the backend and is used internally to generate predictions.
20. Why FastAPI?
FastAPI is used as the backend API framework because it provides a lightweight and high-performance communication layer between the React frontend and Python services.
It exposes the machine-learning prediction and maritime routing functionality through REST APIs.
In simple terms:
React Frontend
      ↓
   FastAPI
      ↓
Python ML + Routing
21. Why CatBoost?
CatBoost is used for freight-rate regression because the project contains many categorical variables.
Examples include:
Countries
Ports
Cargo types
Vessel types
CatBoost provides a practical way to handle these categorical features for freight-rate prediction.
22. Why SeaRoute?
Maritime transportation cannot be represented accurately by simply drawing a straight geographic line between two ports.
SeaRoute is used to calculate a maritime route that follows navigable water geography.
This allows the system to provide:
Maritime route coordinates
Route distance
Map visualization
More realistic shipping-route information
23. End-to-End System Workflow
1. User opens Freight Intelligence
                    ↓
2. Selects origin and destination ports
                    ↓
3. Enters cargo and shipment information
                    ↓
4. React sends the request to FastAPI
                    ↓
5. FastAPI validates the request
                    ↓
6. CatBoost predicts the freight rate
                    ↓
7. SeaRoute calculates the maritime route
                    ↓
8. Backend returns the results
                    ↓
9. React displays the prediction
                    ↓
10. Route is displayed on the map
                    ↓
11. User receives freight-planning insights
24. Project Objective
The objective of Freight Intelligence is to combine:
Machine Learning
       +
Maritime Routing
       +
Shipment Information
       ↓
Data-Driven Freight Decisions
The platform is designed to support more informed decisions for:
Freight forecasting
Vessel chartering
Bulk cargo procurement
Maritime route evaluation
Cost-oriented planning
25. Repository Structure
SIH26006-Intelligent-Freight-Forecasting/
│
├── backend/
├── frontend/
├── .gitattributes
├── .gitignore
└── README.md
26. Team
GridWalkers
Smart India Hackathon – SIH26006
Project: Intelligent Freight Forecasting
Application: Freight Intelligence
License
This project is developed for the Smart India Hackathon (SIH26006) and is intended for project demonstration and evaluation purposes.

### For your GitHub repository

Your root should ideally look like:

```text
SIH26006-Intelligent-Freight-Forecasting/
├── backend/
├── frontend/
├── .gitattributes
├── .gitignore
└── README.md