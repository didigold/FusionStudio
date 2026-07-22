import unittest

from backend.core.ga_marks import (
    GA_MARKS_VERSION,
    accumulated_distraction_up_to,
    flatten_middle_marks,
    normalize_periods,
    period_metrics,
    to_storage,
)


class TestNormalizePeriods(unittest.TestCase):
    def test_legacy_flat_list_pairs(self):
        periods = normalize_periods([6.3, 9.5, 12.0, 13.0])
        self.assertEqual(len(periods), 2)
        self.assertEqual(periods[0], {
            "move_start": None, "gaze_on": 6.3, "move_end": 9.5, "road_on": None,
        })
        self.assertEqual(periods[1], {
            "move_start": None, "gaze_on": 12.0, "move_end": 13.0, "road_on": None,
        })

    def test_legacy_flat_list_odd_trailing_mark(self):
        periods = normalize_periods([6.3, 9.5, 12.0])
        self.assertEqual(len(periods), 2)
        self.assertEqual(periods[1]["gaze_on"], 12.0)
        self.assertIsNone(periods[1]["move_end"])

    def test_v2_dict(self):
        entry = {
            "version": 2,
            "periods": [
                {"move_start": 5.8, "gaze_on": 6.3, "move_end": 9.5, "road_on": 9.9},
            ],
        }
        periods = normalize_periods(entry)
        self.assertEqual(len(periods), 1)
        self.assertEqual(periods[0]["move_start"], 5.8)
        self.assertEqual(periods[0]["road_on"], 9.9)

    def test_v2_dict_partial_period(self):
        entry = {"version": 2, "periods": [{"gaze_on": 6.3, "move_end": 9.5}]}
        periods = normalize_periods(entry)
        self.assertEqual(len(periods), 1)
        self.assertIsNone(periods[0]["move_start"])
        self.assertIsNone(periods[0]["road_on"])

    def test_empty_and_invalid(self):
        self.assertEqual(normalize_periods(None), [])
        self.assertEqual(normalize_periods([]), [])
        self.assertEqual(normalize_periods({}), [])
        self.assertEqual(normalize_periods({"periods": [{"move_start": None}]}), [])
        self.assertEqual(normalize_periods(["abc", None]), [])

    def test_periods_sorted_chronologically(self):
        entry = {"version": 2, "periods": [
            {"gaze_on": 12.0, "move_end": 13.0},
            {"gaze_on": 6.3, "move_end": 9.5},
        ]}
        periods = normalize_periods(entry)
        self.assertEqual(periods[0]["gaze_on"], 6.3)
        self.assertEqual(periods[1]["gaze_on"], 12.0)


class TestFlattenMiddleMarks(unittest.TestCase):
    def test_legacy_roundtrip(self):
        legacy = [6.3, 9.5, 12.0, 13.0]
        self.assertEqual(flatten_middle_marks(normalize_periods(legacy)), legacy)

    def test_v2_flattens_to_middle_marks(self):
        periods = normalize_periods({"version": 2, "periods": [
            {"move_start": 5.8, "gaze_on": 6.3, "move_end": 9.5, "road_on": 9.9},
        ]})
        self.assertEqual(flatten_middle_marks(periods), [6.3, 9.5])

    def test_skips_missing_values(self):
        periods = normalize_periods({"version": 2, "periods": [
            {"move_start": 5.8, "road_on": 9.9},
        ]})
        self.assertEqual(flatten_middle_marks(periods), [])


class TestToStorage(unittest.TestCase):
    def test_storage_payload(self):
        periods = [{"move_start": 5.8, "gaze_on": 6.3, "move_end": 9.5, "road_on": None}]
        payload = to_storage(periods)
        self.assertEqual(payload["version"], GA_MARKS_VERSION)
        self.assertEqual(len(payload["periods"]), 1)

    def test_empty_returns_none(self):
        self.assertIsNone(to_storage([]))
        self.assertIsNone(to_storage([{"move_start": None}]))
        self.assertIsNone(to_storage(None))

    def test_storage_roundtrip(self):
        periods = [{"move_start": 5.8, "gaze_on": 6.3, "move_end": 9.5, "road_on": 9.9}]
        self.assertEqual(normalize_periods(to_storage(periods)), periods)


class TestPeriodMetrics(unittest.TestCase):
    def test_full_period(self):
        m = period_metrics({"move_start": 5.8, "gaze_on": 6.3, "move_end": 9.5, "road_on": 9.9})
        self.assertAlmostEqual(m["t_trans_away"], 0.5)
        self.assertAlmostEqual(m["t_vats"], 3.2)
        self.assertAlmostEqual(m["t_trans_back"], 0.4)

    def test_partial_period(self):
        m = period_metrics({"gaze_on": 6.3, "move_end": 9.5})
        self.assertIsNone(m["t_trans_away"])
        self.assertAlmostEqual(m["t_vats"], 3.2)
        self.assertIsNone(m["t_trans_back"])


class TestAccumulatedDistraction(unittest.TestCase):
    def _legacy_accumulated(self, marks_sorted, warn_time):
        accumulated = 0.0
        for i in range(0, len(marks_sorted) - 1, 2):
            start = marks_sorted[i]
            end = marks_sorted[i + 1]
            if warn_time < start:
                break
            elif warn_time <= end:
                accumulated += (warn_time - start)
                break
            else:
                accumulated += (end - start)
        return accumulated

    def test_matches_legacy_algorithm(self):
        legacy = [6.3, 9.5, 12.0, 13.0, 15.0, 16.5]
        periods = normalize_periods(legacy)
        for warn_time in (5.0, 6.3, 7.5, 9.5, 10.0, 12.5, 14.0, 16.0, 20.0):
            self.assertAlmostEqual(
                accumulated_distraction_up_to(periods, warn_time),
                self._legacy_accumulated(legacy, warn_time),
                msg=f"warn_time={warn_time}",
            )

    def test_none_warn_time(self):
        periods = normalize_periods([6.3, 9.5])
        self.assertEqual(accumulated_distraction_up_to(periods, None), 0.0)


if __name__ == "__main__":
    unittest.main()
