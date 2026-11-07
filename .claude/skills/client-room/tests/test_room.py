import io, json, os, sys, tempfile, unittest
from contextlib import redirect_stdout
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import room as R  # noqa: E402


class Room(unittest.TestCase):
    def setUp(self):
        self.cwd = os.getcwd()
        os.chdir(tempfile.mkdtemp())
        with redirect_stdout(io.StringIO()):
            R.main(["new", "websites for restaurants", "--where", "Austin", "--price", "$1,500"])

    def tearDown(self):
        os.chdir(self.cwd)

    def lead(self, hunter, leads):
        json.dump({"hunter": hunter, "leads": leads}, open(R.path("leads", hunter + ".json"), "w"))

    def test_twelve_hunters_four_methods(self):
        h = R.hunters()
        self.assertEqual(len(h), 12)
        self.assertEqual({x["method"] for x in h}, set(R.METHODS))

    def test_merge_drops_unproven_and_joins_duplicates(self):
        p = [{"url": "https://maps.example/review/1", "note": "site broken"}]
        self.lead("reviews-1", [{"name": "Taco Place", "website": "https://www.tacoplace.com", "proof": p},
                                {"name": "Ghost Diner", "website": "", "proof": []}])
        self.lead("new-2", [{"name": "Taco Place LLC", "website": "https://tacoplace.com/menu",
                             "proof": [{"url": "https://news.example/opening"}]}])
        m = R.merge()
        self.assertEqual(len(m), 1)
        self.assertEqual(len(m[0]["found_by"]), 2)
        self.assertEqual(len(m[0]["proof"]), 2)

    def test_door_needs_seven_and_bad_votes_are_thrown(self):
        self.lead("jobs-1", [{"name": "A", "website": "https://a.com", "proof": [{"url": "https://a.com/job"}]},
                             {"name": "B", "website": "https://b.com", "proof": [{"url": "https://b.com/job"}]}])
        R.merge()
        for i in range(12):
            yes = [{"n": 1, "why": "x"}] + ([{"n": 2}] if i < 6 else []) + [{"n": 99}]
            json.dump({"yes": yes}, open(R.path("votes", f"v{i}.json"), "w"))
        t = R.tally()
        self.assertTrue(t[0]["out"] and t[0]["yes"] == 12)
        self.assertFalse(t[1]["out"])
        self.assertEqual(json.load(open(R.path("tally.json")))["thrown_out"], 12)
        json.dump({"messages": {"1": "Hi A"}}, open(R.path("messages.json"), "w"))
        top = R.report()
        self.assertEqual(len(top), 1)
        self.assertIn("Hi A", open(R.path("REPORT.md")).read())


if __name__ == "__main__":
    unittest.main()
