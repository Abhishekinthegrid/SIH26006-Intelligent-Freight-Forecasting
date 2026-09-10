# SIH26006 – Intelligent Freight Forecasting

## Freight Intelligence

**Team:** GridWalkers  
**SIH Problem Statement:** Development of an Intelligent Freight
Forecasting Model for Optimized Vessel Chartering and Bulk Cargo
Procurement from overseas to East Coast of India.

------------------------------------------------------------------------

## Overview

**Freight Intelligence** is an AI-powered maritime freight
decision-support system designed to help users estimate freight rates,
evaluate vessel options, and visualize practical maritime routes for
bulk cargo transportation.

The system combines:

- **CatBoost machine learning** for freight-rate forecasting
- **SeaRoute-based maritime routing** for water-route calculation
- **FastAPI** for backend API services
- **React + Vite** for the interactive frontend
- **Leaflet-based map visualization** for route presentation

The goal is to turn shipment information into an actionable
freight-planning result.

------------------------------------------------------------------------

## Key Features

### 1. Freight Rate Forecasting

The user provides shipment information such as:

- Origin country and port
- Destination country and port
- Cargo type
- Quantity in tonnes
- Vessel type
- Fuel price
- Port congestion
- Month

The backend processes these inputs through the trained **CatBoost
regression model** and returns a predicted freight rate.

### 2. Maritime Route Calculation

The system calculates a maritime route between the selected ports using
SeaRoute.

The routing system is designed to:

- Prefer navigable maritime paths
- Avoid land crossings
- Calculate route distance
- Validate route geometry
- Return route coordinates for map visualization

### 3. Vessel Intelligence

The application supports multiple bulk-carrier vessel categories,
including:

- Handysize
- Handymax
- Supramax
- Ultramax
- Panamax
- Kamsarmax
- Post-Panamax
- Capesize
- Newcastlemax
- VLOC

### 4. Decision Support

The application combines the forecasting and routing outputs to present
useful planning information such as:

- Predicted freight rate
- Estimated total cost
- Recommended vessel
- Route distance
- Route visualization
- Planning insights

------------------------------------------------------------------------

## System Architecture

``` text
                 ┌─────────────────────┐
                 │    React Frontend   │
                 │       Vercel        │
                 └──────────┬──────────┘
                            │ HTTPS / REST API
                            ▼
                 ┌─────────────────────┐
                 │      FastAPI        │
                 │      Backend        │
                 │       Render        │
                 └───────┬─────┬───────┘
                         │     │
              ┌──────────┘     └──────────┐
              ▼                           ▼
     ┌─────────────────┐         ┌─────────────────┐
     │ CatBoost Model  │         │ Maritime Route  │
     │ Freight Forecast│         │ SeaRoute Engine  │
     └─────────────────┘         └─────────────────┘
              │                           │
              └──────────┬────────────────┘
                         ▼
                 ┌─────────────────────┐
                 │ Optimized Freight   │
                 │ Decision Output     │
                 └─────────────────────┘
```

------------------------------------------------------------------------

## Technology Stack

| Layer               | Technology       |
|---------------------|------------------|
| Frontend            | React            |
| Build Tool          | Vite             |
| Language            | JavaScript / JSX |
| Maps                | Leaflet          |
| Backend             | Python           |
| API Framework       | FastAPI          |
| Machine Learning    | CatBoost         |
| Maritime Routing    | SeaRoute         |
| Frontend Deployment | Vercel           |
| Backend Deployment  | Render           |
| Dataset             | CSV              |
| Model Format        | CatBoost `.cbm`  |

