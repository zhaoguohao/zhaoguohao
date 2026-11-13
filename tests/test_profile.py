import sys, unittest
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from profile import aggregate, year_progress, text
class ProfileTests(unittest.TestCase):
 def test_public_sources_only(self):
  good={'isPrivate':False,'isFork':False,'stargazerCount':4,'languages':{'edges':[{'size':30,'node':{'name':'C#','color':'#178600'}},{'size':10,'node':{'name':'Lua','color':'#000080'}}]}}
  self.assertEqual(aggregate([good,dict(good,isFork=True),dict(good,isPrivate=True)])['stars'],4)
  self.assertEqual(aggregate([good])['languages'][0]['bytes'],30)
 def test_empty_languages(self): self.assertEqual(aggregate([]),{'stars':0,'languages':[]})
 def test_year_boundary(self):
  self.assertEqual(year_progress(datetime(2026,1,1,tzinfo=timezone.utc)),0)
  self.assertAlmostEqual(year_progress(datetime(2024,7,2,tzinfo=timezone.utc)),.5)
 def test_xml_escape(self): self.assertIn('A&amp;B&lt;',text(0,0,'A&B<'))
if __name__=='__main__': unittest.main()
