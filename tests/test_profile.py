import sys, unittest
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from profile import aggregate, year_progress, text, snake_panel, ROOT
import xml.etree.ElementTree as ET
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
 def test_snake_animation_is_preserved(self):
  ns = '{http://www.w3.org/2000/svg}'
  source = ET.parse(ROOT / 'assets/github-contribution-grid-snake.svg').getroot()
  result = ET.fromstring(snake_panel())
  original_css = next(source.iter(ns + 'style')).text
  composed_css = next(result.iter(ns + 'style')).text
  # Only palette variables may change; all motion/eating keyframes stay intact.
  self.assertEqual(original_css.split('}', 1)[1], composed_css.split('}', 1)[1])
  segments = [e for e in source if 's' in e.get('class', '').split()]
  groups = [e for e in result.iter(ns + 'g') if 's' in e.get('class', '').split()]
  self.assertEqual([e.get('class') for e in segments], [e.get('class') for e in groups])
  head = next(e for e in groups if 's0' in e.get('class', '').split())
  self.assertEqual(len(head.findall(ns + 'circle')), 4)
  self.assertEqual(len(list(result.iter(ns + 'linearGradient'))), 1)
 def test_snake_render_is_repeatable(self):
  self.assertEqual(snake_panel(), snake_panel())
if __name__=='__main__': unittest.main()
