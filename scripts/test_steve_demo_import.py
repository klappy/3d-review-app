import importlib.util,json,pathlib,sqlite3,unittest,copy
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('importer',pathlib.Path(__file__).with_name('steve-demo-import.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ImportTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.executescript((m.ROOT/'migrations/0001_init.sql').read_text());self.db.executescript((m.ROOT/'migrations/0004_pinned_instruments.sql').read_text());self.db.execute("INSERT INTO principal(id,provisioned,created_at)VALUES('SAMPLE_owner',1,'test')");self.db.commit()
  with patch.object(m,'validate_source'), patch.object(m,'inventory_minnesota',return_value={'mock_rows':91,'status':'quarantined'}):
   self.plan=m.build_plan('SAMPLE_owner','Steve demo assessments',pathlib.Path('/unused-source'),'2026-10-15T00:00:00Z')
 def test_complete_idempotent_and_provenance(self):
  self.assertEqual(m.preflight(self.db,self.plan)['status'],'ready');m.apply_local(self.db,self.plan);self.assertEqual(m.apply_local(self.db,self.plan)['status'],'already imported');self.assertEqual(self.db.execute('SELECT COUNT(*) FROM response').fetchone()[0],425);self.assertEqual(self.db.execute("SELECT COUNT(*) FROM response WHERE source='synthetic'").fetchone()[0],425);self.assertEqual(self.plan['quarantined']['mock_rows'],91)
 def test_collision_refused(self):
  w=self.plan['workspace_id'];self.db.execute('INSERT INTO workspace(id,name,created_at)VALUES(?,?,?)',(w,'User work','test'));self.db.commit()
  with self.assertRaisesRegex(ValueError,'collision'):m.apply_local(self.db,self.plan)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM project').fetchone()[0],0)
 def test_mid_batch_failure_rolls_everything_back(self):
  self.db.execute("CREATE TRIGGER fail_response BEFORE INSERT ON response BEGIN SELECT RAISE(ABORT,'simulated storage failure'); END;")
  with self.assertRaises(sqlite3.IntegrityError):m.apply_local(self.db,self.plan)
  for table in ['workspace','project','assessment','response','receipt']:self.assertEqual(self.db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0],0)
 def test_instrument_change_refused(self):
  self.db.execute("UPDATE survey_template SET items_json='[]'");self.db.commit()
  with self.assertRaisesRegex(ValueError,'instrument'):m.apply_local(self.db,self.plan)
 def test_mapping_loss_refused(self):
  r=json.loads((m.ROOT/'seed/synthetic/answer-sets.json').read_text())[0];t=m.templates()[r['form_variant']];r['answers']['bad-item']={'selected':['fake']}
  with self.assertRaisesRegex(ValueError,'Unknown item'):m.map_answers(r,t)
 def test_tampered_plan_refused(self):
  self.plan['rows']['workspace'][0]['name']='changed'
  with self.assertRaisesRegex(ValueError,'hash'):m.apply_local(self.db,self.plan)
 def batch(self):
  with patch.object(m,'build_plan',return_value=self.plan):
   return m.build_batch(self.plan,self.plan['plan_sha256'],pathlib.Path('/unused-source'))['batch']
 def run_batch(self,batch):
  with self.db:
   self.db.execute('BEGIN IMMEDIATE')
   for item in batch:self.db.execute(item['sql'],item['params']).fetchall()
 def test_actual_rest_batch_sql_idempotency(self):
  self.plan=json.loads(m.canonical(self.plan))
  b=self.batch();self.run_batch(b);self.run_batch(b)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM response').fetchone()[0],425)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM receipt').fetchone()[0],1)
 def test_actual_rest_batch_sql_rolls_back(self):
  self.db.execute("CREATE TRIGGER fail_response BEFORE INSERT ON response BEGIN SELECT RAISE(ABORT,'simulated failure'); END;")
  with self.assertRaises(sqlite3.IntegrityError):self.run_batch(self.batch())
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM workspace').fetchone()[0],0)
 def test_actual_rest_batch_transformed_rows_roll_back(self):
  self.db.execute("CREATE TRIGGER transform_project AFTER INSERT ON project BEGIN UPDATE project SET name='unexpected transformed name' WHERE id=NEW.id; END;")
  with self.assertRaises(sqlite3.OperationalError):self.run_batch(self.batch())
  for table in m.TABLE_ORDER+['receipt']:
   self.assertEqual(self.db.execute('SELECT COUNT(*) FROM "'+table+'"').fetchone()[0],0)
 def test_actual_rest_batch_receipt_mismatch_refused(self):
  self.run_batch(self.batch())
  self.db.execute("UPDATE receipt SET prior_state_json=json_set(prior_state_json,'$.counts.response',0)");self.db.commit()
  with self.assertRaises(sqlite3.OperationalError):self.run_batch(self.batch())
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM response').fetchone()[0],425)
 def test_actual_rest_batch_partial_refused(self):
  self.db.execute('INSERT INTO workspace(id,name,created_at)VALUES(?,?,?)',(self.plan['workspace_id'],'collision','test'));self.db.commit()
  with self.assertRaises(sqlite3.OperationalError):self.run_batch(self.batch())
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM project').fetchone()[0],0)
 def test_actual_rest_batch_changed_instrument_refused(self):
  self.db.execute("UPDATE survey_template SET items_json='[]'");self.db.commit()
  with self.assertRaises(sqlite3.OperationalError):self.run_batch(self.batch())
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM workspace').fetchone()[0],0)
 def tearDown(self):self.db.close()
if __name__=='__main__':unittest.main()
