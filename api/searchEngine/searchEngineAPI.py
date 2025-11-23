from api.firebase_data.firebase_config import models_db

models = models_db.collection("printables").stream()
for model in models:
    print(model.to_dict())