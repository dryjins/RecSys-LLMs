# HW5: From Ratings to Recommendations

**Student:** Sanzhar Tokkozhin  **Year:** 2  **Submission date:** 13 October 2026  **Course:** LLM4Rec, HSE University

## 1. Abstract

This report addresses rating prediction and Top-10 recommendation for the Week 5 assignment [1]. A 16-factor matrix-factorization model [4] was trained with TensorFlow.js [5] on MovieLens 100K [2], [3] under a per-user chronological 80/10/10 split. The checkpoint selected by validation RMSE (epoch 2) reaches a test RMSE of 1.0415 against 1.2289 for the training-mean baseline, a 15.25% reduction. Retrieval is weak: Recall@10 is 0.0148 over 861 evaluable users. Comparing users 1 and 802, the lists mostly repeat established genre preferences, with a few well-supported cross-genre suggestions that could serve discovery. Four of ten titles in each list rest on fewer than ten training ratings, so their high scores are weakly supported and should not be read as reliable novelty.

## 2. Problem, Data, and Method

**Problem.** Given past ratings, predict the rating a user would give an unrated movie, and rank unrated movies into a Top-10 list. Matrix factorization is an established approach to this task; Koren et al. report it as superior to classic nearest-neighbour techniques for product recommendation [4].

**Data.** MovieLens 100K contains 100,000 ratings on a 1–5 scale from 943 users on 1,682 movies, each user having rated at least 20 movies [2]; [3] is the citation the dataset requires. The real user–movie matrix has 943 × 1,682 = 1,586,126 cells, so density is 6.3047% and sparsity 93.6953%. The starter's padded 944 × 1,683 array is not used as a denominator. A missing rating is unobserved, not a zero: the model is fitted only to observed training ratings.

**Split.** Each user's ratings are sorted by timestamp and cut into 80% train, 10% validation and the remaining test portion [1], giving 79,619 / 9,596 / 10,785 ratings. No user was dropped by the split's minimum-ratings rule. The training mean is $\mu = 3.580603$.

**Model.** Each user $u$ and movie $i$ has a 16-dimensional factor vector, and the prediction is

$$\hat r(u,i) = \mathrm{clamp}(\mu + p_u \cdot q_i,\ 1,\ 5).$$

Training uses the unclamped value. Each mini-batch gathers the relevant factor rows, computes mean squared error, and adds a batch-local L2 penalty: the mean squared norm of the gathered user and movie rows times 0.05, rather than penalizing both full matrices at every step. The optimizer is Adam with learning rate 0.01, batch size 64, for 20 epochs, with seeded initialization and shuffling. After each epoch the train and validation RMSE are recorded; the factors are copied whenever validation RMSE strictly improves, and the best copy is restored into the live model before training returns. The run used TensorFlow.js 4.22.0 on the WebGL backend, which executes tensor operations on the GPU through shader programs [5].

**Recommendation and retrieval.** A user's Top-10 excludes every movie that user rated in train or validation; test-rated movies stay eligible. Ranking uses the unclamped score and the displayed score is clamped. A test rating of at least 4 is relevant. For each evaluable user, recall is the share of that user's relevant movies found in the Top-10, and Recall@10 is the mean over evaluable users.

**Starter contradiction.** The README describes training-set movies as the candidates [1], but the executable self-check and stub contract require `recommendTopK` to rank the full catalogue. The implementation follows the executable contract: the full catalogue is ranked, and the training-movie pool decides which relevant test movies are eligible. In this run no movie absent from training occupied any Top-10 slot, so restricting the ranking to training movies would not change the reported result.

## 3. Verification and Results

| Quantity | Value |
|---|---|
| Selected epoch | 2 |
| Train RMSE at epoch 2 | 0.801066 |
| Validation RMSE at epoch 2 | 1.003173 |
| Test RMSE, restored checkpoint | 1.041541 |
| Test RMSE, training-mean baseline | 1.228900 |
| Absolute improvement | 0.187359 |
| Relative improvement | 15.25% |
| Recall@10 | 0.014818 |
| Evaluable users | 861 |
| Total hits | 88 |
| Users with at least one hit | 76 |
| Unseen relevant movie ids (excluded) | 13 |
| Users without an eligible relevant test movie (excluded) | 82 |

**Reading the results.** Epoch 2 was selected because it has the lowest validation RMSE, and its factors were restored before the test split was scored. The model at epoch 20 is not the reported model: by then train RMSE had fallen to 0.6966 while validation RMSE had risen to 1.0276, which indicates overfitting after epoch 2. The factorization clearly improves rating prediction over the baseline, yet Recall@10 remains very low. One training run took about 39.8 s on WebGL; this is a machine-specific browser observation, not a benchmark. The page does not render the factorization's test RMSE, so it was obtained by evaluating `computeRMSEFor(testSet)` in the browser console.

**Automated harness.** The supplied self-checks report 11 passed, 0 failed, 0 pending.

**Independent computational checks (Claude Code).** A separate script recomputed the split sizes, density, training mean, baseline RMSE and the three model-independent recall counts (861, 13, 82) from the raw files. In the browser, one prediction (user 1, *Fargo*) and the test RMSE were recomputed from the extracted factors and agreed to within 1e-7; the live model's validation RMSE equalled the epoch-2 history value, confirming restoration; Recall@10 was recomputed from the recommendation outputs and matched; and three training runs on the same machine produced identical histories.

**Manual checks (student).** I personally ran the supplied harness and saw 11 passed, 0 failed, 0 pending; trained with the unchanged defaults; saw epoch 2 highlighted as the selected checkpoint with validation RMSE 1.0032; and ran *Evaluate Recall@10*, which showed 0.0148. All other checks in this section were performed by Claude Code, not by me.

## 4. Familiar Choices vs. New Discoveries

*Do the recommendations help users discover movies, or mainly repeat existing preferences?* [1] "Support" below is the number of training ratings a movie has. Histories cover train and validation only; test ratings were consulted only afterwards, for evaluation.

**User 1** has 244 ratings, 144 of them at least 4; the leading liked genres are Drama 68, Comedy 42 and Action 37. Five-star titles include *Monty Python and the Holy Grail*, *Jean de Florette*, *The Godfather* and *Wallace & Gromit: The Best of Aardman Animation*.

| # | Title | Score | Support |
|---|---|---|---|
| 1 | Wrong Trousers, The (1993) | 5.0000 | 101 |
| 2 | Pather Panchali (1955) | 5.0000 | 7 |
| 3 | Aparajito (1956) | 4.8866 | 5 |
| 4 | Duck Soup (1933) | 4.8759 | 76 |
| 5 | Casablanca (1942) | 4.8183 | 222 |
| 6 | Laura (1944) | 4.7191 | 33 |
| 7 | Faithful (1996) | 4.6610 | 5 |
| 8 | Four Days in September (1997) | 4.6381 | 6 |
| 9 | Big Sleep, The (1946) | 4.6365 | 62 |
| 10 | Down by Law (1986) | 4.6296 | 28 |

**User 802** has 67 ratings, 34 of them at least 4; the leading liked genres are Thriller 17, Action 15 and Horror 14. Five-star titles include *Aliens*, *Alien*, *Jaws*, *A Nightmare on Elm Street* and *Contact*.

| # | Title | Score | Support |
|---|---|---|---|
| 1 | Princess Bride, The (1987) | 4.4630 | 292 |
| 2 | Titanic (1997) | 4.4324 | 277 |
| 3 | Return of the Jedi (1983) | 4.3902 | 460 |
| 4 | Little Princess, The (1939) | 4.3773 | 4 |
| 5 | Star Trek: The Wrath of Khan (1982) | 4.3435 | 206 |
| 6 | Faithful (1996) | 4.2692 | 5 |
| 7 | Empire Strikes Back, The (1980) | 4.2498 | 330 |
| 8 | Mystery Science Theater 3000: The Movie (1996) | 4.2439 | 114 |
| 9 | Wild Things (1998) | 4.2297 | 6 |
| 10 | Lost in Space (1998) | 4.2247 | 4 |

| Statistic | User 1 | User 802 |
|---|---|---|
| Share a top-three liked genre | 8/10 | 7/10 |
| Support below 10 | 4 | 4 |
| Support of at least 100 | 2 | 6 |
| Median support | 30.5 | 160 |
| Familiar / plausible discovery / thin-data | 4 / 2 / 4 | 3 / 3 / 4 |
| Relevant test hits | 1 | 0 |

**Mostly familiar.** User 1's list largely repeats Drama and Comedy: *Casablanca*, *Duck Soup* and *Down by Law* fit the history, and *The Wrong Trousers* follows a five-star rating for another Aardman title. That film is also a retrospective evaluation hit, rated 5 in the test split, which the model could not see when ranking. User 802's list repeats the Action/Sci-Fi side of the history through *Return of the Jedi*, *The Empire Strikes Back* and *Star Trek: The Wrath of Khan*, close to *Aliens* and *Contact*. It contains no Horror title, although Horror is one of this user's three leading genres, so the repetition is partial.

**Some plausible discovery.** For user 1, *Laura* and *The Big Sleep* are film noir, a genre nearly absent from the liked history, and both have moderate support. For user 802, *The Princess Bride*, *Titanic* and *Mystery Science Theater 3000* lie outside the thriller–horror pattern and are well supported.

**Thin-data risk.** Both lists contain four movies with fewer than 10 training ratings. *Faithful* appears in both, for users with different tastes, on only five ratings: sixteen factors fitted to so few ratings mostly reflect those few raters. Such items may be real finds, but this evidence cannot separate them from noise, so I class them as uncertain rather than as discoveries.

**Why Recall@10 is low.** Training minimizes squared error on observed ratings, not a ranking loss; ranking covers the full unrated catalogue; and thin-data items occupy many leading positions. User 1 has one relevant hit and user 802 none.

**Value to a platform.** Well-supported familiar titles could populate a "because you rated…" row, and supported cross-genre titles could seed an exploration row. A sensible safeguard is to require minimum item support, or to shrink low-support scores toward the mean, before an item may enter a list. Any such change should be validated in a prospective A/B test. These lists are offline associations in historical ratings; no effect on engagement, retention or revenue was measured.

## 5. Limitations, AI Assistance, and References

**Limitations.** Recall@10 is very low, so the model is not yet a usable retriever. Thin-data items make the lists unstable. The model has no user or item bias terms beyond the global mean. Reproducibility was shown on one machine only, and runtime and WebGL arithmetic may differ elsewhere. Nine source titles show encoding artefacts in the page, although the titles reported here render correctly. Offline associations in historical ratings do not establish causal outcomes. The provided synchronous training wrapper freezes the page while training runs. The homework-guidelines file referenced by the README [1] is not in the repository, so this report follows the README's own criteria. The session export comes from Claude Code and differs from the OpenCode export command the README names.

**AI assistance.** Claude Code inspected the repository, implemented the six stubs, ran browser checks, performed the independent computations, verified the citations, and helped draft this report. I personally ran the supplied tests, trained with the unchanged defaults, observed the selected checkpoint, and ran Recall@10. Temporary external probes were verification aids and are not deliverables; no Python or notebook implementation is part of the submission. For [3] the bibliographic record was checked against the DOI registry and the dataset README, and [4] is cited only for the claim in its abstract. I take responsibility for this submission.

**References**

[1] S. Jin, "HW5 — From Ratings to Recommendations (Matrix Factorization)," instructor starter, `dryjins/RecSys-LLMs`, HSE University, 2026. [Online]. Available: https://github.com/dryjins/RecSys-LLMs/tree/main/week5

[2] GroupLens Research, "MovieLens 100K Dataset," README, 1998. [Online]. Available: https://files.grouplens.org/datasets/movielens/ml-100k-README.txt

[3] F. M. Harper and J. A. Konstan, "The MovieLens datasets: History and context," *ACM Transactions on Interactive Intelligent Systems*, vol. 5, no. 4, Art. 19, Dec. 2015. doi: 10.1145/2827872. [Online]. Available: https://doi.org/10.1145/2827872

[4] Y. Koren, R. Bell, and C. Volinsky, "Matrix factorization techniques for recommender systems," *Computer*, vol. 42, no. 8, pp. 30–37, Aug. 2009. doi: 10.1109/MC.2009.263. [Online]. Available: https://doi.org/10.1109/MC.2009.263

[5] TensorFlow, "Platform and environment," TensorFlow.js guide. [Online]. Available: https://www.tensorflow.org/js/guide/platform_environment
