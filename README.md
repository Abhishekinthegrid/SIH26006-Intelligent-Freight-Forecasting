SIH26006 – Intelligent Freight Forecasting
Freight Intelligence
Team: GridWalkers
SIH Problem Statement: Development of an Intelligent Freight
Forecasting Model for Optimized Vessel Chartering and Bulk Cargo
Procurement from overseas to East Coast of India.
------------------------------------------------------------------------
Overview
Freight Intelligence is an AI-powered maritime freight
decision-support system designed to help users estimate freight rates,
evaluate vessel options, and visualize practical maritime routes for
bulk cargo transportation.
The system combines:
• **CatBoost machine learning** for freight-rate forecasting
• **SeaRoute-based maritime routing** for water-route calculation
• **FastAPI** for backend API services
• **React + Vite** for the interactive frontend
• **Leaflet-based map visualization** for route presentation
The goal is to turn shipment information into an actionable
freight-planning result.
------------------------------------------------------------------------
Key Features
1. Freight Rate Forecasting
The user provides shipment information such as:
• Origin country and port
• Destination country and port
• Cargo type
• Quantity in tonnes
• Vessel type
• Fuel price
• Port congestion• Month
The backend processes these inputs through the trained **CatBoost
regression model** and returns a predicted freight rate.
2. Maritime Route Calculation
The system calculates a maritime route between the selected ports using
SeaRoute.
The routing system is designed to:
• Prefer navigable maritime paths
• Avoid land crossings
• Calculate route distance
• Validate route geometry
• Return route coordinates for map visualization
3. Vessel Intelligence
The application supports multiple bulk-carrier vessel categories,
including:
• Handysize
• Handymax
• Supramax
• Ultramax
• Panamax
• Kamsarmax
• Post-Panamax
• Capesize
• Newcastlemax
• VLOC
4. Decision Support
The application combines the forecasting and routing outputs to present
useful planning information such as:
• Predicted freight rate
• Estimated total cost
• Recommended vessel
• Route distance
• Route visualization
• Planning insights------------------------------------------------------------------------
System Architecture
            ■■■■■■■■■■■■■■■■■■■■■■■
■ React Frontend ■
■ Vercel ■
■■■■■■■■■■■■■■■■■■■■■■■
■ HTTPS / REST API
▼
■■■■■■■■■■■■■■■■■■■■■■■
■ FastAPI ■
■ Backend ■
■ Render ■
■■■■■■■■■■■■■■■■■■■■■■■
■ ■
■■■■■■■■■■■■ ■■■■■■■■■■■■
 ▼  ■■■■■■■■■■■■■■■■■■■  ■ CatBoost Model ■  ■ Freight Forecast■  ■■■■■■■■■■■■■■■■■■■ ▼
■■■■■■■■■■■■■■■■■■■
■ Maritime Route ■
■ SeaRoute Engine ■
■■■■■■■■■■■■■■■■■■■
       ■ ■
■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
▼
■■■■■■■■■■■■■■■■■■■■■■■
■ Optimized Freight ■
■ Decision Output ■
■■■■■■■■■■■■■■■■■■■■■■■
------------------------------------------------------------------------
Technology Stack
Layer Technology
Frontend React
Build Tool Vite
Language JavaScript / JSX
Maps Leaflet
Backend Python
API Framework FastAPI
Machine Learning CatBoost
Maritime Routing SeaRoute
Frontend Deployment Vercel
Backend Deployment Render
Dataset CSV
Model Format CatBoost `.cbm`
------------------------------------------------------------------------
Project Structure
SIH26006-Intelligent-Freight-Forecasting/
■■■ backend/
■ ■■■ app/
■ ■ ■■■ ml/
■ ■ ■ ■■■ train_model.py■ ■ ■ ■■■ predictor.py
■ ■ ■■■ main.py
■ ■ ■■■ ports.py
■ ■ ■■■ routing.py
■ ■ ■■■ routing_grid.py
■ ■ ■■■ routing_searoute_legacy.py
■ ■ ■■■ schemas.py
■ ■ ■■■ db.py
■ ■■■ data/
■ ■ ■■■ maritime_ai_training_1m.csv
■ ■ ■■■ landmask.geojson
■ ■ ■■■ README.txt
■ ■■■ models/
■ ■ ■■■ freight_model.cbm
■ ■ ■■■ model_meta.json
■ ■■■ requirements.txt
■ ■■■ .env.example
■
■■■ frontend/
■ ■■■ public/
■ ■ ■■■ vessels/
■ ■■■ src/
■ ■ ■■■ App.jsx
■ ■ ■■■ main.jsx
■ ■ ■■■ portData.js
■ ■■■ index.html
■ ■■■ package.json
■ ■■■ vite.config.js
■ ■■■ .env.example
■
■■■ .gitattributes
■■■ .gitignore
■■■ README.md
------------------------------------------------------------------------
Dataset
The primary training dataset is:
`backend/data/maritime_ai_training_1m.csv`
It contains approximately 1,000,000 records and includes features
such as:
• Origin country
• Origin port
• Destination country
• Destination port
• Cargo type
• Quantity
• Vessel type
• Fuel price
• Port congestion
• Month
• Freight rate
The prediction target is:`freight_rate_usd_tonne`
The large CSV is managed using Git LFS.
------------------------------------------------------------------------
Machine Learning Pipeline
The machine-learning workflow is:
Training Dataset
 ■
 ▼
train_model.py
 ■
 ▼
CatBoost Regression
 ■
 ■■■ freight_model.cbm
 ■■■ model_meta.json
 ■
 ▼
predictor.py
 ■
 ▼
FastAPI /api/predict
 ■
 ▼
React Frontend
Model
The system uses CatBoost Regression because the dataset contains
categorical features such as ports, countries, cargo types, and vessel
types.
The trained model is stored as:
backend/models/freight_model.cbm
Model metadata is stored as:
backend/models/model_meta.json
------------------------------------------------------------------------
Maritime Routing
The routing pipeline is:
Origin Port
 +
Destination Port
 ■
 ▼
FastAPI
 ■
 ▼
routing.py
 ■
 ▼
SeaRoute
 ■ ▼
Maritime Route
 ■
 ■■■ Distance
 ■■■ Coordinates
 ■
 ▼
Leaflet Map
The routing system uses maritime route calculation rather than simply
drawing a straight line between ports.
A landmask is also available at:
backend/data/landmask.geojson
for geographic route validation.
------------------------------------------------------------------------
API Endpoints
Health Check
GET /health
Checks backend and model availability.
Metadata
GET /api/metadata
Returns application/model metadata used by the frontend.
Freight Prediction
POST /api/predict
Receives shipment information and returns the freight forecasting
result.
Maritime Route
POST /api/route
Calculates the maritime route between the selected ports.
------------------------------------------------------------------------
Local Setup
Backend
From the `backend` directory:
python -m venv venvActivate the virtual environment.
Windows:
venv\Scripts\activate
Install dependencies:
pip install -r requirements.txt
Start FastAPI:
uvicorn app.main:app --reload
The local API will normally be available at:
http://127.0.0.1:8000
Frontend
From the `frontend` directory:
npm install
Start the Vite development server:
npm run dev
The frontend will normally run at:
http://localhost:5173
------------------------------------------------------------------------
Environment Configuration
Frontend
The frontend can use:
VITE_API_URL
Example:
VITE_API_URL=https://sih26006-backend.onrender.com
Backend
Backend environment variables can be configured using:
backend/.env.example
Do not commit private credentials or secrets to GitHub.
------------------------------------------------------------------------Deployment
Frontend
The React application is deployed using Vercel.
Production frontend:
https://sih-26006-intelligent-freight-forecasting-4lypplwz1.vercel.app
Backend
The FastAPI application is deployed using Render.
Production backend:
https://sih26006-backend.onrender.com
The frontend communicates with the backend through HTTPS REST APIs.
------------------------------------------------------------------------
Security
The application follows basic deployment security practices:
• HTTPS communication
• CORS-based origin restriction
• Environment-based configuration for secrets
• Backend-side ML model isolation
• Trained model is not sent directly to the browser
The client interacts with API endpoints rather than directly accessing
the model internals.
------------------------------------------------------------------------
Why FastAPI?
FastAPI provides the communication layer between the React frontend and
the Python backend.
It allows the application to expose:
• ML prediction services
• Maritime routing services
• Health checks
• Metadata servicesThis makes the CatBoost and SeaRoute functionality accessible to the
React application through REST APIs.
------------------------------------------------------------------------
Why CatBoost?
CatBoost is well suited to this project because many important input
variables are categorical.
Examples include:
• Country
• Port
• Cargo type
• Vessel type
CatBoost can work effectively with categorical features while providing
a practical regression model for freight-rate prediction.
------------------------------------------------------------------------
Why SeaRoute?
A simple geographic straight line is not sufficient for maritime
transportation.
SeaRoute is used to calculate a route that follows navigable maritime
geography, allowing the application to provide a more meaningful
shipping route and distance for the selected ports.
------------------------------------------------------------------------
End-to-End Workflow
1. User selects origin and destination
 ↓
2. User enters cargo and shipment details
 ↓
↓
3. React sends request to FastAPI
 4. FastAPI validates the request
 ↓
5. CatBoost predicts freight rate
 ↓
6. SeaRoute calculates maritime route
 ↓
7. Backend returns prediction + route data
 ↓
8. React displays results and map
 ↓
9. User uses the result for freight planning
------------------------------------------------------------------------Project Objective
The objective of Freight Intelligence is to support better maritime
freight decisions by combining:
Machine Learning + Maritime Routing + Shipment Information
into a single decision-support platform.
This helps users move from manually estimating freight requirements
toward a data-driven approach for:
• Freight forecasting
• Vessel planning
• Bulk cargo procurement
• Maritime route evaluation
• Cost-oriented decision making
------------------------------------------------------------------------
Team
GridWalkers
SIH26006 – Intelligent Freight Forecasting
Built for the Smart India Hackathon.
------------------------------------------------------------