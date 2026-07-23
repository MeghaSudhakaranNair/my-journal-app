from textblob import TextBlob


def analyze_sentiment(text: str) -> float:
    """Return polarity in [-1, 1] using TextBlob's lexicon-based analyzer."""
    polarity = TextBlob(text).sentiment.polarity
    return round(float(polarity), 2)
