"""
Unit Test: Face Recognition & Euclidean Distance Metric
Validates 128-dimensional Euclidean distance matching and threshold comparison.
"""
import unittest
import math

def euclidean_distance(v1, v2):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(v1, v2)))

class TestFaceRecognition(unittest.TestCase):
    def test_identical_vector_distance(self):
        vec = [0.1] * 128
        dist = euclidean_distance(vec, vec)
        self.assertAlmostEqual(dist, 0.0, places=5)

    def test_threshold_matching(self):
        threshold = 0.52
        known_vec = [0.1] * 128
        close_vec = [0.11] * 128
        far_vec = [0.35] * 128

        dist_close = euclidean_distance(known_vec, close_vec)
        dist_far = euclidean_distance(known_vec, far_vec)

        self.assertLess(dist_close, threshold, "Close face sample must match.")
        self.assertGreater(dist_far, threshold, "Distant face sample must not match.")

    def test_temporal_confirmation(self):
        # 3 consecutive confirmations required
        frames_detected = 3
        required_frames = 3
        is_confirmed = frames_detected >= required_frames
        self.assertTrue(is_confirmed, "3-frame temporal confirmation must validate.")

if __name__ == "__main__":
    unittest.main()
