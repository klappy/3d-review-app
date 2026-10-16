#!/usr/bin/env python3
"""Build a source-pinned synthetic import plan. No account or database writes.

The reviewed operator executes the plan only after destination preflight and atomic
execution have been verified. This is not cap.import.batch or a participant replay.
"""
import argparse, csv, hashlib, json, pathlib, re, subprocess
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
PIN = 'f042cde553761a6a7f24132cef7802f956378ee0'
TABLE_ORDER = ['workspace', 'project', 'language', 'assessment', 'assessment_survey', 'grant', 'response']
ANSWERS_SHA256 = 'efc50c5ff9139d9235e4323233d27c54059527f92c54099e2f9dbf0cd71df1b5'

def digest(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

def templates():
    sql = (ROOT / 'migrations/0004_pinned_instruments.sql').read_text()
    result = {}
    for m in re.finditer(r"VALUES \('(tpl_[a-z_]*)', 2, '([^']*)', '[^']*', '[^']*', '(\[.*?\])', '(\{.*?\})', ", sql, re.S):
        result[m[2]] = {'id': m[1], 'version': 2, 'items': json.loads(m[3].replace("''", "'")), 'scoring': json.loads(m[4].replace("''", "'"))}
    if len(result) != 9:
        raise ValueError('Pinned template parser did not recover all nine forms')
    return result

def map_answers(record, template):
    items = {i['id']: i for i in template['items']}
    mapped = {}
    for key, answer in record['answers'].items():
        if key not in items:
            raise ValueError(f"Unknown item {record['submission_id']}:{key}")
        item = items[key]
        choices = answer['selected']
        codes = []
        for value in choices:
            if '[object Object]' in value:
                raise ValueError('Unrecoverable serialized object placeholder')
            if item['type'] == 'text':
                codes.append(value)
            else:
                matches = [o['code'] for o in item.get('options', []) if o['text'] == value]
                if len(matches) != 1:
                    raise ValueError(f"Unknown or ambiguous option {record['submission_id']}:{key}")
                codes.append(matches[0])
        if item['type'] != 'multi' and len(codes) > 1:
            raise ValueError(f'Multiple values for scalar item {key}')
        if codes:
            mapped[key] = codes if item['type'] == 'multi' else codes[0]
    for key, item in items.items():
        if key not in mapped:
            # Historical synthetic input preserves absence; it is not a new participant submission.
            # Required-but-absent values stay absent and are disclosed in the lossless import receipt.
            if item.get('required') is False:
                mapped[key] = None
    return mapped

def inventory_minnesota(source):
    files = []
    mock_ids = set()
    for path in sorted((source / 'survey-pipeline/data/raw/minnesota-nice').rglob('*.csv')):
        with path.open(encoding='utf-8-sig') as handle:
            rows = list(csv.DictReader(handle))
        mock = [r for r in rows if r.get('is_mock') == 'true']
        for row in mock:
            if row['submission_id'] in mock_ids:
                raise ValueError('Duplicate Minnesota submission ID')
            mock_ids.add(row['submission_id'])
        bad = [(r['submission_id'], k) for r in mock for k, v in r.items() if k.startswith('Q') and v and '[object Object]' in v]
        files.append({'path': str(path.relative_to(source)), 'sha256': digest(path.read_bytes()), 'mock_rows': len(mock), 'excluded_nonmock_rows': len(rows)-len(mock), 'broken_answer_cells': len(bad), 'affected_rows': len({x[0] for x in bad})})
    return {'files': files, 'mock_rows': len(mock_ids), 'status': 'quarantined pending original structured answer recovery; no answer inference'}

def validate_source(source):
    observed = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    if observed != PIN or subprocess.check_output(['git', '-C', str(source), 'status', '--porcelain'], text=True).strip():
        raise ValueError('Source checkout must be clean at exact pin')

def build_plan(owner, workspace_name, source, at):
    if datetime.fromisoformat(at.replace("Z", "+00:00")).tzinfo is None:
        raise ValueError("Import time must include timezone")
    if not re.fullmatch(r'[A-Za-z0-9_-]+', owner) or not workspace_name.strip():
        raise ValueError('Explicit owner ID and workspace name required')
    validate_source(source)
    raw = (ROOT / 'seed/synthetic/answer-sets.json').read_bytes()
    if digest(raw) != ANSWERS_SHA256:
        raise ValueError('Answer-set hash differs from pinned source')
    records = json.loads(raw)
    if len(records) != 425 or len({r['submission_id'] for r in records}) != len(records):
        raise ValueError('Expected 425 unique pinned submissions')
    ts = templates()
    namespace = digest(owner + ':' + PIN + ':steve-demo-v1')[:16]
    ident = lambda kind, key: kind + '_sd_' + digest(namespace + ':' + kind + ':' + key)[:24]
    workspace = ident('ws', 'workspace')
    rows = {t: {} for t in TABLE_ORDER}
    def add(table, row):
        old = rows[table].get(row['id'])
        if old is not None and old != row:
            raise ValueError('Source ID collision: ' + table)
        rows[table][row['id']] = row
    def grant(scope, scope_id):
        add('grant', dict(id=ident('grant', scope+':'+scope_id), principal_id=owner, scope_type=scope, scope_id=scope_id, role='owner', created_at=at))
    add('workspace', dict(id=workspace, name=workspace_name, created_at=at, created_by=owner)); grant('workspace', workspace)
    for r in records:
        pid, lid, aid = ident('proj', r['project_id']), ident('lang', r['language_id']), ident('assess', r['assessment_cycle'])
        t = ts[r['form_variant']]
        sid = ident('survey', r['assessment_cycle']+':'+t['id'])
        name = r['project_id'].replace('-', ' ').title()
        add('project', dict(id=pid, workspace_id=workspace, name=name+' (synthetic demo)', organization='Steve synthetic personas', created_at=at, created_by=owner))
        add('language', dict(id=lid, project_id=pid, name=name+' (invented language)', code='qaa', created_at=at))
        add('assessment', dict(id=aid, project_id=pid, language_id=lid, name=r['assessment_cycle']+' (synthetic demo)', purpose='Source-pinned Steve persona scenario; synthetic responses. Source '+PIN, period=r['assessment_cycle'].rsplit('-',2)[-2]+'-'+r['assessment_cycle'].rsplit('-',1)[-1], format='written', stage='understand', created_at=at, created_by=owner))
        add('assessment_survey', dict(id=sid, assessment_id=aid, template_id=t['id'], template_version=2, state='selected', collection_status='closed', created_at=at))
        grant('project', pid); grant('assessment', aid)
        provenance = dict(synthetic=True, source_repo='klappy/3d-quality-review', source_commit=PIN, answer_set_sha256=ANSWERS_SHA256, source_submission_id=r['submission_id'], persona=r['respondent_persona'], import_namespace=namespace)
        add('response', dict(id=ident('resp', r['submission_id']), assessment_survey_id=sid, respondent_id=ident('respondent', r['respondent_persona']), idempotency_key='steve-demo:'+r['submission_id'], answers_json=canonical(map_answers(r,t)), template_id=t['id'], template_version=2, provenance_json=canonical(provenance), source='synthetic', submitted_at=r['submitted_at']))
    quarantine = inventory_minnesota(source)
    # Keep the existing demo project visible, without pretending its broken exports are responses.
    pid, lid, aid = ident('proj','minnesota-nice'), ident('lang','minnesota-nice-andy-test'), ident('assess','minnesota-nice-andy-test-2026-05')
    add('project',dict(id=pid,workspace_id=workspace,name='Minnesota Nice (synthetic demo)',organization=None,created_at=at,created_by=owner))
    add('language',dict(id=lid,project_id=pid,name='Andy Test (demo)',code=None,created_at=at))
    add('assessment',dict(id=aid,project_id=pid,language_id=lid,name='Minnesota Nice — May 2026 (source answers unavailable)',purpose='91 source rows explicitly flagged mock; their exported answer payloads are [object Object] and are not imported. Two nonmock rows excluded. No usable responses or scores are claimed. Source '+PIN,period='2026-05',format=None,stage='prepare',created_at=at,created_by=owner))
    grant('project',pid);grant('assessment',aid)
    plan = dict(created_at=at,contract='steve-demo-import@1', source_commit=PIN, answer_set_sha256=ANSWERS_SHA256, owner=owner, workspace_id=workspace, workspace_name=workspace_name, namespace=namespace, counts={k:len(v) for k,v in rows.items()}, rows={k:list(v.values()) for k,v in rows.items()}, templates=[dict(id=t['id'],version=2,items_json=canonical(t['items']),scoring_json=canonical(t['scoring'])) for t in ts.values() if any(r['template_id']==t['id'] for r in rows['assessment_survey'].values())], quarantined=quarantine)
    plan['source_missing_required_answers'] = sum(1 for r in records for i in ts[r['form_variant']]['items'] if i.get('required') is True and not r['answers'].get(i['id'], {}).get('selected'))
    plan['plan_sha256'] = digest(canonical(plan))
    return plan



def preflight(connection, plan):
    """Read-only destination check. Refuse partial imports, collisions and changed instruments."""
    if digest(canonical({k:v for k,v in plan.items() if k!='plan_sha256'})) != plan['plan_sha256']:
        raise ValueError('Plan hash mismatch')
    owner = connection.execute('SELECT id FROM principal WHERE id=? AND provisioned=1', (plan['owner'],)).fetchone()
    if not owner:
        raise ValueError('Destination owner is absent or unprovisioned')
    for t in plan['templates']:
        actual = connection.execute('SELECT items_json,scoring_json FROM survey_template WHERE id=? AND version=?', (t['id'],t['version'])).fetchone()
        if not actual or any(json.loads(a)!=json.loads(t[k]) for a,k in zip(actual,['items_json','scoring_json'])):
            raise ValueError('Destination instrument differs: '+t['id'])
    present = 0
    total = sum(plan['counts'].values())
    for table, rows in plan['rows'].items():
        for row in rows:
            columns = list(row)
            actual = connection.execute('SELECT '+','.join('"'+c+'"' for c in columns)+' FROM "'+table+'" WHERE id=?',(row['id'],)).fetchone()
            if actual:
                if list(actual)!=list(row.values()):
                    raise ValueError('Destination collision: '+table+':'+row['id'])
                present += 1
    receipt_id='rc_sd_'+plan['namespace']
    receipt=connection.execute('SELECT prior_state_json FROM receipt WHERE id=?',(receipt_id,)).fetchone()
    if present == total and receipt and json.loads(receipt[0]).get('plan_sha256')==plan['plan_sha256']:
        return {'status':'already imported','existing':present,'new':0}
    if present or receipt:
        raise ValueError('Partial or mismatched prior import; no changes allowed')
    return {'status':'ready','existing':0,'new':total}


def apply_local(connection, plan):
    """Transaction contract exercised by tests; production must use verified D1 atomic batch."""
    with connection:
        connection.execute('BEGIN IMMEDIATE')
        state=preflight(connection,plan)
        if state['status']=='already imported':
            return state
        for table in TABLE_ORDER:
            rows=plan['rows'][table]
            for row in rows:
                columns=list(row)
                connection.execute('INSERT INTO "'+table+'" ('+','.join('"'+c+'"' for c in columns)+') VALUES ('+','.join('?' for _ in columns)+')',list(row.values()))
        receipt={'plan_sha256':plan['plan_sha256'],'counts':plan['counts'],'source_commit':plan['source_commit'],'answer_set_sha256':plan['answer_set_sha256'],'quarantined':plan['quarantined'],'source_missing_required_answers':plan['source_missing_required_answers']}
        connection.execute('INSERT INTO receipt(id,actor,capability,scope_type,scope_id,class,inverse,trace_id,prior_state_json,at) VALUES(?,?,?,?,?,?,?,?,?,?)',('rc_sd_'+plan['namespace'],plan['owner'],'script.steve_demo_import','workspace',plan['workspace_id'],'write.reversible','reviewed namespace removal only','script_sd_'+plan['namespace'],canonical(receipt),plan['created_at']))
        if preflight(connection,plan)['status']!='already imported':
            raise ValueError('Readback did not match complete plan')
    return {'status':'imported','counts':plan['counts']}


def build_batch(plan, expected_hash, source):
    """Cloudflare D1 REST /query body: one atomic {batch:[{sql,params},...]}.

    Exact reviewed hash plus regeneration from the clean pinned source is required.
    Every guard is inside the same transaction as inserts and the receipt.
    """
    if expected_hash != plan.get('plan_sha256'):
        raise ValueError('Expected reviewed plan hash differs')
    regenerated=build_plan(plan['owner'],plan['workspace_name'],source,plan['created_at'])
    if canonical(regenerated)!=canonical(plan):
        raise ValueError('Plan does not match the pinned source and fixed import schema')
    allowed={'workspace','project','language','assessment','assessment_survey','grant','response'}
    if set(plan['rows'])!=allowed or any(plan['counts'][t]!=len(rows) for t,rows in plan['rows'].items()):
        raise ValueError('Invalid import table/count schema')
    batch=[]
    def statement(sql, params=()): batch.append({'sql':sql,'params':list(params)})
    def guard(condition, params=()):
        statement("SELECT CASE WHEN ("+condition+") THEN 1 ELSE json('STEVE_IMPORT_GUARD_FAILED') END AS verified",params)
    guard('EXISTS(SELECT 1 FROM principal WHERE id=? AND provisioned=1)',[plan['owner']])
    for t in plan['templates']:
        guard('EXISTS(SELECT 1 FROM survey_template WHERE id=? AND version=?)',[t['id'],t['version']])
        for field in ['items_json','scoring_json']:
            actual='SELECT fullkey,type,atom FROM json_tree((SELECT '+field+' FROM survey_template WHERE id=? AND version=?))'
            expected='SELECT fullkey,type,atom FROM json_tree(?)'
            guard('NOT EXISTS('+actual+' EXCEPT '+expected+') AND NOT EXISTS('+expected+' EXCEPT '+actual+')',[t['id'],t['version'],t[field],t[field],t['id'],t['version']])
    receipt_id='rc_sd_'+plan['namespace']
    total_sql=[];total_params=[]
    for table in TABLE_ORDER:
        rows=plan['rows'][table]
        total_sql.append('(SELECT COUNT(*) FROM "'+table+'" WHERE id IN (SELECT value FROM json_each(?)))')
        total_params.append(canonical([r['id'] for r in rows]))
    total=' + '.join(total_sql)
    guard('(('+total+')=0 AND NOT EXISTS(SELECT 1 FROM receipt WHERE id=?)) OR (('+total+')=? AND EXISTS(SELECT 1 FROM receipt WHERE id=? AND json_extract(prior_state_json,\'$.plan_sha256\')=?))',total_params+[receipt_id]+total_params+[sum(plan['counts'].values()),receipt_id,expected_hash])
    for table in TABLE_ORDER:
        rows=plan['rows'][table]
        columns=list(rows[0])
        if any(list(r)!=columns for r in rows):
            raise ValueError('Inconsistent fixed column schema')
        payload=canonical(rows)
        extract=lambda c: "json_extract(j.value,'$."+c+"')"
        same=' AND '.join('actual."'+c+'" IS '+extract(c) for c in columns)
        guard('NOT EXISTS(SELECT 1 FROM json_each(?) j JOIN "'+table+'" actual ON actual.id='+extract('id')+' WHERE NOT ('+same+'))',[payload])
        statement('INSERT INTO "'+table+'" ('+','.join('"'+c+'"' for c in columns)+') SELECT '+','.join(extract(c) for c in columns)+' FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM "'+table+'" actual WHERE actual.id='+extract('id')+')',[payload])
    receipt={'plan_sha256':expected_hash,'counts':plan['counts'],'source_commit':plan['source_commit'],'answer_set_sha256':plan['answer_set_sha256'],'quarantined':plan['quarantined'],'source_missing_required_answers':plan['source_missing_required_answers']}
    statement('INSERT INTO receipt(id,actor,capability,scope_type,scope_id,class,inverse,trace_id,prior_state_json,at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM receipt WHERE id=?)',[receipt_id,plan['owner'],'script.steve_demo_import','workspace',plan['workspace_id'],'write.reversible','reviewed namespace removal only','script_sd_'+plan['namespace'],canonical(receipt),plan['created_at'],receipt_id])
    for table in TABLE_ORDER:
        rows=plan['rows'][table]
        guard('(SELECT COUNT(*) FROM "'+table+'" WHERE id IN (SELECT value FROM json_each(?)))=?',[canonical([r['id'] for r in rows]),len(rows)])
        same=' AND '.join('actual."'+c+'" IS '+"json_extract(j.value,'$."+c+"')" for c in rows[0])
        guard("NOT EXISTS(SELECT 1 FROM json_each(?) j JOIN \""+table+"\" actual ON actual.id=json_extract(j.value,'$.id') WHERE NOT ("+same+"))",[canonical(rows)])
    guard('EXISTS(SELECT 1 FROM receipt WHERE id IS ? AND actor IS ? AND capability IS ? AND scope_type IS ? AND scope_id IS ? AND class IS ? AND inverse IS ? AND trace_id IS ? AND prior_state_json IS ? AND at IS ?)',[receipt_id,plan['owner'],'script.steve_demo_import','workspace',plan['workspace_id'],'write.reversible','reviewed namespace removal only','script_sd_'+plan['namespace'],canonical(receipt),plan['created_at']])
    return {'batch':batch}


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',required=True,type=pathlib.Path)
    p.add_argument('--owner',required=True)
    p.add_argument('--workspace-name',required=True)
    p.add_argument('--plan-output',type=pathlib.Path)
    p.add_argument('--at',default=datetime.now(timezone.utc).isoformat())
    p.add_argument('--batch-output',type=pathlib.Path)
    p.add_argument('--expected-plan-hash')
    args=p.parse_args()
    plan=build_plan(args.owner,args.workspace_name,args.source,args.at)
    if args.plan_output:
        args.plan_output.write_text(canonical(plan)+'\n')
    if args.batch_output:
        if not args.expected_plan_hash:
            p.error('--batch-output requires the externally reviewed --expected-plan-hash')
        args.batch_output.write_text(canonical(build_batch(plan,args.expected_plan_hash,args.source))+'\n')
    print(json.dumps({k:v for k,v in plan.items() if k not in ['rows','templates']},indent=2))
