"""
Full MVP flow through the real UI in two browsers (web build), no emulator needed:
Wayan sends a package to Made → Made accepts, starts the trip, picks up, arrives,
types a wrong code (must be refused) then the right one → Wayan sees it delivered and rates.

Run with the backend and the web app running and fresh demo data:
    cd server && npm run db:reset && npm start        # terminal 1
    cd app && npx expo start --web --port 8081        # terminal 2
    pip install playwright && python -m playwright install chromium
    python app/e2e/web/full_flow.py                   # screenshots go to ./e2e-web-shots

Env: API (default http://localhost:3000), WEB (http://localhost:8081), CHROME (path to a
Chrome binary; default: Playwright's Chromium), OUT (screenshot folder).
Map tiles and Leaflet are served from the internet; set LEAFLET_DIR to a local
node_modules/leaflet/dist folder to run fully offline.
"""
import json, urllib.request, asyncio, sys, re, time
from playwright.async_api import async_playwright, expect
import os
API=os.environ.get('API','http://localhost:3000'); WEB=os.environ.get('WEB','http://localhost:8081')
OUT=os.environ.get('OUT','e2e-web-shots')
def login(p):
    r=urllib.request.Request(API+'/auth/login', data=json.dumps({'phone':p,'password':'kirimin123'}).encode(), headers={'content-type':'application/json'})
    return json.load(urllib.request.urlopen(r))['token']
LEAF=os.environ.get('LEAFLET_DIR')
async def route(r):
    u=r.request.url
    if LEAF and 'unpkg.com/leaflet' in u:
        f='leaflet.css' if u.endswith('.css') else 'leaflet.js'
        await r.fulfill(path=os.path.join(LEAF, f), content_type='text/css' if f.endswith('css') else 'application/javascript')
    elif LEAF and ('cartocdn' in u or 'tile.openstreetmap' in u):
        await r.fulfill(status=204)
    else: await r.continue_()
step_no=0
async def step(pg, name):
    global step_no; step_no+=1
    await pg.screenshot(path=f'{OUT}/{step_no:02d}-{name}.png'); print(f'  ✓ {step_no:02d} {name}')
async def session(b, phone):
    ctx=await b.new_context(viewport={'width':390,'height':844}); await ctx.route('**/*', route)
    pg=await ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(WEB+'/'); await pg.evaluate("t=>localStorage.setItem('kirimin_auth_token',t)", login(phone))
    await pg.goto(WEB+'/'); await pg.wait_for_timeout(3000)
    return pg, errs
async def main():
  os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    S,serr=await session(b,'081200000001'); D,derr=await session(b,'081200000003')
    T=dict(timeout=15000)
    print('Sender: create order')
    await S.get_by_text('Cari tujuan pengiriman').click()
    await expect(S.get_by_text('Siapa penerimanya?')).to_be_visible(**T)
    await S.get_by_placeholder('Contoh: Dewa').fill('Raka')
    await S.get_by_placeholder('Contoh: 081234567890').fill('081288887777'); await step(S,'rute')
    await S.get_by_text('Lanjut ke detail paket').click()
    await expect(S.get_by_text('Paketnya apa?')).to_be_visible(**T); await step(S,'paket')
    await S.get_by_text('Cari pengemudi searah').click()
    await expect(S.get_by_text('Made S.').first).to_be_visible(**T); await step(S,'driver')
    # Made's earliest "Ke Kampus" departure (recurring routes also list tomorrow's): first Made card's button.
    await S.get_by_text('Made S.', exact=True).first.locator("xpath=following::*[normalize-space(text())='Pilih'][1]").click()
    await expect(S.get_by_text('Cek lalu kirim')).to_be_visible(**T); await step(S,'konfirmasi')
    await S.get_by_text('Kirim ke Made').click()
    await expect(S.get_by_text(re.compile(r'^Pesanan KRM-'))).to_be_visible(**T)
    code=''.join(re.findall(r'\d', await S.get_by_test_id('handover-code-display').inner_text()))[:4]
    order_code=(await S.get_by_text(re.compile(r'^Pesanan KRM-')).inner_text()).split()[-1]
    print('  order', order_code, 'code', code); await step(S,'lacak-requested')

    print('Driver: accept, drive, hand over')
    await D.get_by_text('Lihat permintaan').click()
    card=D.locator('div').filter(has_text=re.compile('Wayan')).filter(has=D.get_by_text('Terima', exact=True)).last
    await expect(card).to_be_visible(**T); await step(D,'permintaan')
    await card.get_by_text('Terima', exact=True).click()
    await expect(D.get_by_text(re.compile(r'^Mulai perjalanan \('))).to_be_visible(**T)
    await D.get_by_text(re.compile(r'^Mulai perjalanan \(')).click()
    await expect(D.get_by_text('Mulai perjalanan', exact=True)).to_be_visible(**T); await step(D,'jalan-siap')
    await D.get_by_text('Mulai perjalanan', exact=True).click()
    for label in ['Paket sudah dijemput','Saya sudah sampai']:
        btn=D.get_by_text(label, exact=True).first
        await expect(btn).to_be_visible(**T); await btn.click(); await D.wait_for_timeout(1200)
    await step(D,'jalan-tiba')
    await D.get_by_text('Masukkan kode penerima', exact=True).first.click()
    await expect(D.get_by_text('Masukkan kode dari penerima')).to_be_visible(**T)
    wrong='0000' if code!='0000' else '1111'
    await D.get_by_test_id('handover-code').click(); await D.keyboard.type(wrong)
    await D.get_by_text('Selesai, paket diserahkan').click(); await D.wait_for_timeout(1500)
    assert await D.get_by_text('Paket sudah diserahkan').count()==0, 'wrong code was accepted!'
    await step(D,'kode-salah')
    await D.get_by_test_id('handover-code').click()
    for _ in range(4): await D.keyboard.press('Backspace')
    await D.keyboard.type(code)
    await D.get_by_text('Selesai, paket diserahkan').click()
    await expect(D.get_by_text('Paket sudah diserahkan')).to_be_visible(**T); await step(D,'diserahkan')

    print('Sender: sees delivery (live) and rates')
    await expect(S.get_by_text('Selesai').first).to_be_visible(timeout=20000); await step(S,'lacak-selesai')
    await S.get_by_text('Beri nilai pengemudi').click()
    await expect(S.get_by_text('Kirim nilai')).to_be_visible(**T)
    await S.get_by_text('Kirim nilai').click(); await S.wait_for_timeout(2000); await step(S,'setelah-nilai')
    print('page errors:', serr+derr or 'none')
    await b.close()
asyncio.run(main())
