// Stub: sharp is for image pipelines; engram only does text embeddings.
// @xenova/transformers checks `if (sharp)` at module init — must be truthy
// to avoid throwing "Unable to load image processing library".
// The actual sharp API is never called for feature-extraction pipelines.
module.exports = function sharpStub() { return {}; };
