from pathlib import Path
import json, math, time
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from ..ports import PORT_COORDS

BASE = Path(__file__).resolve().parents[2]
DATA = BASE / 'data' / 'maritime_ai_training_1m.csv'
MODELS = BASE / 'models'
MODELS.mkdir(exist_ok=True)
MONTHS = {m:i for i,m in enumerate(['January','February','March','April','May','June','July','August','September','October','November','December'],1)}

def hav_nm(a,b):
    lat1,lon1=np.radians(a); lat2,lon2=np.radians(b)
    dlat=lat2-lat1; dlon=lon2-lon1
    h=np.sin(dlat/2)**2+np.cos(lat1)*np.cos(lat2)*np.sin(dlon/2)**2
    return float(3440.065*2*np.arcsin(np.sqrt(h)))

def add_features(df):
    df=df.copy()
    df['route_distance_nm']=[hav_nm(PORT_COORDS[a],PORT_COORDS[b]) for a,b in zip(df.origin_port,df.destination_port)]
    df['month_num']=df['month'].map(MONTHS).astype('int16')
    df['country_pair']=df['origin_country'].astype(str)+' -> '+df['destination_country'].astype(str)
    df['port_pair']=df['origin_port'].astype(str)+' -> '+df['destination_port'].astype(str)
    return df

def main():
    if not DATA.exists(): raise SystemExit(f'Missing {DATA}')
    t=time.time(); print('Reading 1,000,000-row dataset...')
    df=pd.read_csv(DATA)
    required=['origin_country','origin_port','destination_country','destination_port','cargo_type','quantity_tonnes','vessel_type','fuel_price_usd_tonne','port_congestion','month','freight_rate_usd_tonne','split']
    missing=[c for c in required if c not in df.columns]
    if missing: raise SystemExit(f'Missing columns: {missing}')
    if len(df)!=1_000_000: print(f'Warning: expected 1,000,000 rows, found {len(df):,}')
    df=add_features(df)
    features=['origin_country','origin_port','destination_country','destination_port','cargo_type','vessel_type','quantity_tonnes','fuel_price_usd_tonne','port_congestion','month_num','route_distance_nm','country_pair','port_pair']
    cats=[0,1,2,3,4,5,11,12]
    # Explicitly ignore provenance/split fields: they are metadata, not predictive truth.
    tr=df[df.split.eq('train')].copy(); va=df[df.split.eq('validation')].copy(); te=df[df.split.eq('test')].copy()
    model=CatBoostRegressor(iterations=500, depth=8, learning_rate=0.07, loss_function='RMSE', eval_metric='RMSE', random_seed=42, verbose=100, thread_count=-1, l2_leaf_reg=6)
    model.fit(tr[features], tr.freight_rate_usd_tonne, cat_features=cats, eval_set=(va[features],va.freight_rate_usd_tonne), early_stopping_rounds=60, use_best_model=True)
    metrics={}
    for name,part in [('validation',va),('test',te)]:
        pred=model.predict(part[features])
        metrics[name]={'mae':float(mean_absolute_error(part.freight_rate_usd_tonne,pred)),'rmse':float(mean_squared_error(part.freight_rate_usd_tonne,pred)**0.5),'r2':float(r2_score(part.freight_rate_usd_tonne,pred))}
        print(name,metrics[name])
    model.save_model(str(MODELS/'freight_model.cbm'))
    meta={'features':features,'categorical_features':cats,'rows_total':int(len(df)),'rows_train':int(len(tr)),'rows_validation':int(len(va)),'rows_test':int(len(te)),'best_iteration':int(model.best_iteration_),'metrics':metrics,'trained_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'route_feature':'route_distance_nm computed from port coordinates','data_file':DATA.name}
    (MODELS/'model_meta.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
    print(f'Model saved. elapsed={time.time()-t:.1f}s')

if __name__=='__main__': main()
