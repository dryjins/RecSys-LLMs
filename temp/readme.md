You are an expert full-stack web developer specializing in in-browser machine learning with TensorFlow.js.

Your task is to generate the complete code for a "Matrix Factorization Movie Recommender" web application. The application will load and parse data, define and train a Matrix Factorization model using TensorFlow.js, and then use the trained model to predict movie ratings. Please provide the code for each of the four files—`index.html`, `style.css`, `data.js`, and `script.js`—separately and clearly labeled.

---

### **Project Specification: Matrix Factorization Recommender with TensorFlow.js**

#### **1. CONTEXT**

The goal is to build a web application that demonstrates Matrix Factorization for collaborative filtering. It will parse the MovieLens 100K dataset (`u.item`, `u.data` from the same url), train a model entirely in the browser using TensorFlow.js, and predict a user's rating for a selected movie. The logic must be modular, split between `data.js` and `script.js`.

#### **2. OUTPUT FORMAT**

Provide four separate, complete code blocks for the following files:
1.  `index.html`
2.  `style.css`
3.  `data.js`
4.  `script.js`

#### **3. `index.html` INSTRUCTIONS**

-   The page must have a title, a main heading, and two dropdown menus: one for selecting a user (`#user-select`) and one for selecting a movie (`#movie-select`).
-   Include a "Predict Rating" button that calls a `predictRating()` function.
-   A result area (`#result`) should display status messages and prediction outcomes.
-   Critically, it must load the TensorFlow.js library from a CDN, followed by `data.js`, and then `script.js` at the end of the `<body>`.
    ```
    <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js"></script>
    <script src="data.js"></script>
    <script src="script.js"></script>
    ```

#### **4. `style.css` INSTRUCTIONS**

-   Create a clean, modern, and centered layout. The design should be professional and user-friendly. (Detailed styling specifications are the same as previous exercises).

#### **5. `data.js` INSTRUCTIONS**

-   This file is responsible for loading and parsing data.
-   It must contain the `loadData()`, `parseItemData(text)`, and `parseRatingData(text)` functions as specified previously.
-   It should also contain two variables to store the number of unique users and movies after parsing, for example: `numUsers` and `numMovies`.

#### **6. `script.js` INSTRUCTIONS**

This file contains the TensorFlow.js model definition, training, and prediction logic.

1.  **Global Variables:**
    -   Declare a global variable `model` to hold the trained TensorFlow.js model.

2.  **Initialization (`window.onload`):**
    -   Create an `async` function that first `await`s `loadData()` from `data.js`.
    -   After data is loaded, it should call functions to populate the user and movie dropdowns.
    -   Then, it must call a new `trainModel()` function to start the training process. Update the UI to show that the model is training.

3.  **Model Definition Function: `createModel(numUsers, numMovies, latentDim)`**
    -   This function will define the Matrix Factorization architecture.
    -   **Inputs:** Create two input layers, one for user IDs (`userInput`) and one for movie IDs (`movieInput`).
    -   **Embedding Layers:**
        -   ?????
        -   ?????
    -   **Latent Vectors:** ????
    -   **Prediction:** ????
    -   **Model Creation:** Create the `tf.model` with the defined inputs and the prediction output.
    -   **Return** the created model.

4.  **Training Function: `trainModel()`**
    -   This must be an `async` function.
    -   **Step 1:** Call `createModel()` to get the model architecture.
    -   **Step 2:** Compile the model using `model.compile()`.
        -   Set the `optimizer` to `tf.train.adam(0.001)`.
        -   Set the `loss` function to `'meanSquaredError'`.
    -   **Step 3:** Prepare the training data. Convert the `ratings` data (user IDs, item IDs) and the actual ratings into TensorFlow tensors (`tf.tensor2d`).
    -   **Step 4:** Train the model by calling `await model.fit()`. Train for a suitable number of epochs (e.g., 5-10) with a reasonable batch size (e.g., 64).
    -   **Step 5:** After training is complete, update the UI to indicate that the model is ready for predictions.

5.  **Prediction Function: `predictRating()`**
    -   This `async` function is called when the user clicks the button.
    -   Get the selected user ID and movie ID from the dropdowns.
    -   Create input tensors for the selected user and movie IDs.
    -   Call `model.predict()` with these tensors.
    -   Use `.data()` to extract the predicted rating value from the output tensor.
    -   Display the predicted rating in the `#result` area in a user-friendly format.

---
Now generate the complete code for `index.html`, `style.css`, `data.js`, and `script.js` based on these final, detailed specifications for a TensorFlow.js implementation.
