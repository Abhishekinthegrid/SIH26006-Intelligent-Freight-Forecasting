# Prediction 503 fix

The saved CatBoost model can have a different feature schema depending on whether it is the bootstrap model or the full 1M-row retrained model.

The predictor now reads the saved model's `feature_names_` and categorical feature indices at runtime and constructs exactly that schema. This prevents errors such as:

`Invalid type for cat_feature ... quantity_tonnes ... cat_features must be integer or string`

No retraining is required for this fix.
