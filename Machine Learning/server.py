from flask import Flask, request, jsonify
from model import predict
from flask_cors import CORS
# from model_ml import train_model, predict

app = Flask(__name__)
CORS(app)

# Dummy data
# data = [[1], [2], [3]]
# target = [2, 4, 6]

# Train the model
# model = train_model(data, target)

@app.route('/predict', methods=['POST'])
def hello():
#   return "Hello World!"
    try:
        # print(type(input_data))
        # return request.json['data']
        input_data = request.json['data']
        prediction = predict(input_data)
        return jsonify({'prediction': prediction})
    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5003, debug=True)
