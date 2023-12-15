import re
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential, load_model  # Update TensorFlow import
from tensorflow.keras.layers import Dense

def predict(inputData):
    # 1. Load Data from txt files
    def load_data(folder_path):
        texts = []
        labels = []
        for label in ['human-written', 'ai-generated']:
            path = os.path.join(folder_path, label)
            for filename in os.listdir(path):
                with open(os.path.join(path, filename), 'r', encoding='utf-8') as file:
                    texts.append(file.read())
                    labels.append(1 if label == 'ai-generated' else 0)  # Updated labels to binary values
        return texts, labels

    data, labels = load_data('dataset_cakrawala') #update path to dataset path

    # 2. Convert text to numerical features using TF-IDF
    tfidf = TfidfVectorizer(ngram_range=(1, 2), min_df=5, max_df=0.7)
    X = tfidf.fit_transform(data).toarray()  # Convert to numpy array

    # Convert labels to numpy array
    y = np.array(labels)

    # 3. Train-test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

    # 4. Define and compile the Keras model
    model = Sequential([
        Dense(64, activation='relu', input_shape=(X_train.shape[1],)),
        Dense(1, activation='sigmoid')
    ])
    # model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])

    # early_stopping = tf.keras.callbacks.EarlyStopping(monitor='val_accuracy', patience=100, mode='max', verbose=1)

    # 5. Train the model
    # history = model.fit(X_train, y_train, epochs=10000, batch_size=32, validation_data=(X_test, y_test), callbacks=[early_stopping])

    # 6. Save the Keras model in HDF5 format (.h5)
    # model.save('training_model_terbaik.h5')

    # Input user text for prediction
    # user_input = input("masukan text: ")
    user_input = inputData

    # Preprocess the user input similar to the training data
    user_input_features = tfidf.transform([user_input]).toarray()

    # Load the trained model for prediction
    loaded_model = load_model('training_model_terbaik.h5')

    # Predict whether the input is AI-generated or human-written
    prediction = loaded_model.predict(user_input_features)
    ai_generated_percentage = prediction[0][0] * 100
    human_written_percentage = (1 - prediction[0][0]) * 100

    # present
    ai_generated_percentage = float(ai_generated_percentage)
    human_written_percentage = float(human_written_percentage)

    # Determine if input is AI-generated or human-written based on a threshold
    threshold = 0.5
    if prediction > threshold:
        input_type = "AI-generated"
    else:
        input_type = "Human-written"

    # Display the percentages of AI-generated and human-written text
    print(f"Persentase text hasil AI: {ai_generated_percentage:.2f}%")
    print(f"Persentase text buatan manusia: {human_written_percentage:.2f}%")

    # Display the conclusion based on the threshold
    print(f"text cenderung buatan : {input_type}")

    # Predict whether the input is AI-generated or human-written
    prediction = loaded_model.predict(user_input_features)
    threshold = 0.5

    # Find sentences with high AI-generated probability
    sentences = re.split(r'(?<=[.!?]) +', user_input)  # Split input into sentences
    ai_generated_sentences = []

    for i, sentence in enumerate(sentences):
        sentence_features = tfidf.transform([sentence]).toarray()
        sentence_prediction = loaded_model.predict(sentence_features)
        if sentence_prediction > threshold:
            ai_generated_sentences.append(sentence)

    # Display AI-generated sentences
    if ai_generated_sentences:
        print("kalimat yang terindikasi buatan AI:")
        for sentence in ai_generated_sentences:
            print(f"- {sentence}")

    dataReturn = {'result': input_type, 'ai_precentage': ai_generated_percentage, 'human_precentage': human_written_percentage, 'list_ai_sentences': ai_generated_sentences}
    return dataReturn