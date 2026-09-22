You are an expert full-stack web developer who creates robust, well-commented, and modular web applications using only vanilla HTML, CSS, and JavaScript.

Your task is to generate the complete code for a "Collaborative Filtering Movie Recommender" web application based on the detailed specifications below. The application logic will be split into two separate JavaScript files: `data.js` for data loading and parsing, and `script.js` for UI and recommendation logic. Please provide the code for each of the four files—`index.html`, `style.css`, `data.js`, and `script.js`—separately and clearly labeled.

---

### **Project Specification: Collaborative Filtering Movie Recommender (Modular)**

#### **1. Overall Goal**

Build a single-page web application that recommends movies using **collaborative filtering**. The application will use `data.js` to load and parse the same MovieLens 100K files as the previous exercise (`u.item`, `u.data`)—the dataset is deliberately unchanged so that the **algorithm** is the only thing that changes between the Content-Based assignment and this one.

Unlike the Content-Based version, which compared movie **genres**, this version uses the **rating patterns of users**. It must produce a Top-5 recommendation list **two ways** for the same active user—**User-Based CF** and **Item-Based CF**—so the two lists can be compared side by side.

#### **2. File `index.html` - The Application Structure**

-   **DOCTYPE and Language:** The document should start with `<!DOCTYPE html>` and the `<html>` tag should specify `lang="en"`.
-   **Title:** The page title should be "Collaborative Filtering Movie Recommender".
-   **Main Heading:** Include an `<h1>` with the text "Collaborative Filtering Movie Recommender".
-   **Instructions:** Add a `<p>` tag explaining that the user picks a user and receives two Top-5 lists (one per CF approach).
-   **User Dropdown:** Include a `<select>` element with the ID `user-select`. It will be populated dynamically with one option per user ID present in `u.data`.
-   **Button:** Include a `<button>` with the text "Get Recommendations". When clicked, it must call the `getRecommendations()` JavaScript function.
-   **Result Display Areas:** Include a `<div>` with the ID `result-box`. Inside it, provide two clearly labelled sections:
    -   `<div id="user-based-result">` — for the User-Based CF Top-5
    -   `<div id="item-based-result">` — for the Item-Based CF Top-5

    Each section should show the recommended movie titles together with their predicted score (or similarity), so the two approaches can be compared directly.
-   **File Linking:** Link `data.js` and `script.js` at the end of the `<body>`. `data.js` must be loaded **before** `script.js`.
    ```
    <script src="data.js"></script>
    <script src="script.js"></script>
    ```

#### **3. File `style.css` - The Application Design**

-   **Layout:** Create a professional, modern, and user-friendly layout. All content should be centered on the page within a main container.
-   **Background:** The `<body>` should have a light, neutral background color (e.g., `#f4f7f6`).
-   **Container:** The main container holding all elements should have a white background, rounded corners (`border-radius`), and a subtle box shadow.
-   **Typography:** Use a clean, sans-serif font like 'Helvetica' or 'Arial'.
-   **Controls:** The `<select>` dropdown and `<button>` should have consistent styling.
-   **Button:** Distinct background colour (e.g., a shade of blue), white text, hover effect.
-   **Result Areas:** `#user-based-result` and `#item-based-result` should be visually separated (e.g., two columns on wide screens, stacked on narrow screens) with a light background and a clear heading each.

#### **4. File `data.js` - The Data Handling Module**

This file is responsible only for fetching and parsing the data from local files, and for building the rating structures.

1.  **Global Variables:** Declare `let movies = [];`, `let ratings = [];`, `let numUsers = 0;`, `let numMovies = 0;`, and `let ratingMatrix = null;`.

2.  **Primary Function: `loadData()`**
    -   Must be `async`.
    -   Uses `fetch()` to read `u.item` and `u.data` (same directory as `index.html`).
    -   Uses `try...catch`; on failure, display an error message in the result area.
    -   Awaits `u.item` first, then `u.data`, passing the text to the parsers.
    -   After parsing: set `numUsers` (max user ID in `ratings`), `numMovies` (number of parsed movies), and call `buildRatingMatrix()`.

3.  **Parsing Function: `parseItemData(text)`**
    -   Defines the 18 genre names ("Action" ... "Western").
    -   Splits by lines; each line split by `|`.
    -   Extracts `id` (field 0) and `title` (field 1); builds a `genres` array from the last 19 fields where the value is `'1'`.
    -   Pushes `{ id, title, genres }` to `movies`.

4.  **Parsing Function: `parseRatingData(text)`**
    -   Splits by lines; each line split by `\t`.
    -   Pushes `{ userId, itemId, rating, timestamp }` (numbers) to `ratings`.

5.  **Matrix Function: `buildRatingMatrix()`**
    -   Builds a 2-D structure of shape `(numUsers + 1) × (numMovies + 1)`, where a missing rating is represented by `0`.
    -   Also build a parallel "rated" boolean mask (or use `0` as "not rated") so the similarity function can distinguish *not rated* from *rated 0*.
    -   Store the result in the global `ratingMatrix`.

#### **5. File `script.js` - The UI and Logic Module**

This file handles the user interface and the collaborative-filtering logic.

1.  **Initialization Logic:**
    -   Use `window.onload` with an `async` function.
    -   `await loadData()`, then call `populateUserDropdown()` and set an initial status message.

2.  **UI Function: `populateUserDropdown()`**
    -   Gets the `#user-select` element.
    -   Adds one `<option>` per user ID from `1` to `numUsers`, with the value set to the integer user ID.

3.  **Similarity Function: `cosineSimilarity(a, b)`**
    -   Computes the cosine similarity between two vectors, **using only co-rated (non-zero) entries**.
    -   Must guard against a zero denominator (return `0` in that case).
    -   Include a comment explaining the missing-value convention chosen here and why (see "Missing Value Handling" below).

4.  **Core Logic - User-Based: `getUserBasedRecommendations(activeUserId, topK)`**
    -   Step 1: For every other user, compute `cosineSimilarity` against the active user's rating vector.
    -   Step 2: Select the `N` most similar users (e.g., `N = 20`) with positive similarity.
    -   Step 3: For each movie the active user has **not** rated, compute a predicted score as the similarity-weighted average of the similar users' ratings.
    -   Step 4: Sort the candidates by predicted score (descending) and take the top `topK` (default `5`).
    -   Return an array of `{ title, score }`.

5.  **Core Logic - Item-Based: `getItemBasedRecommendations(activeUserId, topK)`**
    -   Step 1: For each movie the active user has rated, compute item-to-item `cosineSimilarity` between that movie's rating column and every other movie's rating column.
    -   Step 2: For each candidate movie the user has **not** rated, aggregate the similarities from the user's rated movies, weighted by the user's rating.
    -   Step 3: Sort by the aggregated score (descending) and take the top `topK` (default `5`).
    -   Return an array of `{ title, score }`.

6.  **Display Function: `getRecommendations()`**
    -   Reads `#user-select`, converted to an integer.
    -   Calls both `getUserBasedRecommendations()` and `getItemBasedRecommendations()`.
    -   Renders each list into its own section, in the form *"Because you are similar to other users, we recommend: ..."* / *"Because you liked ... we recommend: ..."*.
    -   Handle the empty case gracefully (a user with too few ratings) with a clear message.

#### **6. Missing Value Handling**

The rating matrix is sparse. Pick **exactly one** strategy and apply it consistently in `cosineSimilarity`. State the choice in a comment at the top of `script.js`:

-   **Use co-rated items only** (ignore missing values): the default and simplest.
-   **Mean imputation** — replace missing entries with the row/column average.
-   **Weighted approach** — weight the similarity by the number of co-rated items.

Do not mix strategies.

#### **7. Notes on This Exercise**

-   Do **not** change the dataset files.
-   Keep the modular split (`data.js` / `script.js`); do not move logic between them.
-   The code must run offline from `file://`-like static hosting (GitHub Pages); no build step and no external libraries.

---
Please now generate the complete code for the `index.html`, `style.css`, `data.js`, and `script.js` files based on these final, detailed specifications.
