"""
IZZAT CAR - Atualizador do Catálogo do Site
Puxa TODOS os anúncios do ML e gera o arquivo products.json
Rodar sempre que quiser atualizar o site com anúncios novos.
"""

import requests
import json
import os
import time
from pathlib import Path
from dotenv import load_dotenv

# Carregar token
env_path = Path(r"C:\Users\Administrator\Desktop\IzzatCar\MercadoLivre\.env")
load_dotenv(env_path)
TOKEN = os.getenv("ML_ACCESS_TOKEN")
SELLER_ID = "2932888131"
SITE_DIR = Path(__file__).resolve().parent

# O token do .env local vive expirando (6h) e renovar aqui rotaciona o refresh
# token que o backend tambem usa. Por isso puxamos os anuncios pelo proxy do
# backend, que mantem o token dele valido sozinho.
# ADMIN_KEY NUNCA entra neste arquivo: o repo do site e publico.
BACKEND = os.getenv("BACKEND_URL", "https://izzat-backend.izzatcar.workers.dev")
ADMIN_KEY = os.getenv("ADMIN_KEY", "")

def fetch_items_backend():
    """Puxa todos os anuncios ativos (item completo) pelo proxy do backend.

    O backend renova o token do ML sozinho, entao esta rota nao expira como o
    ML_ACCESS_TOKEN do .env local.
    """
    if not ADMIN_KEY:
        print("⚠ Sem ADMIN_KEY no .env — nao da pra usar o proxy do backend")
        return []

    print("📦 Buscando anúncios pelo backend...")
    h = {"X-Admin-Key": ADMIN_KEY}
    raw, vistos, scroll_id, total = [], set(), None, 0

    while True:
        params = {"limit": 50}
        if scroll_id:
            params["scroll_id"] = scroll_id
        try:
            r = requests.get(f"{BACKEND}/admin/ml_items_batch", params=params, headers=h, timeout=180)
        except Exception as e:
            print(f"  ⚠ falha na chamada ({e}) — parando com {len(raw)} anúncios")
            break
        if r.status_code != 200:
            print(f"  ⚠ http {r.status_code}: {r.text[:200]}")
            break

        data = r.json()
        total = data.get("total", total)
        lote = data.get("items", [])
        scroll_id = data.get("scroll_id")

        novos = 0
        for it in lote:
            mlb = it.get("id")
            if not mlb or mlb in vistos or it.get("_fetch_error"):
                continue
            vistos.add(mlb)
            raw.append(it)
            novos += 1

        print(f"  {len(raw)}/{total} anúncios...")
        if not lote or not scroll_id or novos == 0:
            break

    print(f"✅ {len(raw)} anúncios recebidos")
    # Download pela metade (backend caiu no meio) nao pode encolher o site:
    # sem esta trava, uma falha apagaria centenas de paginas boas.
    if total and len(raw) < total * 0.95:
        print(f"❌ Baixou so {len(raw)} de {total} — abortando sem mexer no site.")
        raise SystemExit(1)
    return raw


def upscale_img(url):
    if not url:
        return url
    url = url.replace("http:", "https:")
    if "-I.jpg" in url:
        url = url.replace("-I.jpg", "-O.webp")
    elif "-I.webp" in url:
        url = url.replace("-I.webp", "-O.webp")
    return url

def get_items_details(raw_items):
    """Converte os itens crus do ML no formato do site (pictures[], attributes, sold)."""
    print("Montando produtos...")
    products = []
    for item in raw_items:
        if not item or item.get("status") != "active":
            continue

        # Array completo de fotos (capa = [0])
        pics = []
        for p in item.get("pictures", []):
            u = upscale_img(p.get("secure_url", ""))
            if u:
                pics.append(u)
        if not pics and item.get("thumbnail"):
            pics = [upscale_img(item["thumbnail"])]
        img = pics[0] if pics else ""

        # Extrair atributos importantes
        attrs = {}
        for a in item.get("attributes", []):
            aid = a.get("id", "")
            val = a.get("value_name", "") or a.get("value_id", "")
            if aid and val:
                attrs[aid] = val

        oem = attrs.get("OEM", "") or attrs.get("PART_NUMBER", "")
        part_number = attrs.get("PART_NUMBER", "")
        model = attrs.get("MODEL", "")

        # Extrair marca do título (fallback pra atributo BRAND)
        brand = ""
        brands_list = [
            "Volkswagen", "VW", "Chevrolet", "GM", "Fiat", "Ford", "Toyota",
            "Honda", "Hyundai", "Renault", "Citroën", "Citroen", "Peugeot",
            "Nissan", "Kia", "Jeep", "BMW", "Mercedes", "Audi", "Volvo",
            "Jaguar", "Land Rover", "Mitsubishi", "Subaru", "Suzuki", "Chery", "Lifan", "Dodge"
        ]
        title_lower = item.get("title", "").lower()
        for b in brands_list:
            if b.lower() in title_lower:
                brand = b
                break
        if not brand and attrs.get("BRAND"):
            brand = attrs["BRAND"].split()[0] if attrs["BRAND"] else ""

        product = {
            "id": item.get("id", ""),
            "title": item.get("title", ""),
            "price": item.get("price", 0),
            "currency": item.get("currency_id", "BRL"),
            "img": img,
            "pics": pics,
            "url": item.get("permalink", ""),
            "free_shipping": item.get("shipping", {}).get("free_shipping", False),
            "condition": item.get("condition", ""),
            "sold": item.get("sold_quantity", 0),
            "brand": brand,
            "available": item.get("available_quantity", 0),
            "oem": oem,
            "part_number": part_number,
            "model": model,
            "category_id": item.get("category_id", ""),
            "attrs": attrs,
            # data da última mudança do anúncio (o <lastmod> de cada peça no sitemap); sem ela, fica a do catálogo
            "last_updated": item.get("last_updated") or item.get("date_created") or "",
        }
        products.append(product)

    print(f"{len(products)} produtos processados")
    return products

def get_items_descriptions(products):
    """Descricao de cada anuncio (a pagina da peca mostra).

    Reaproveita as que ja estao no products.json anterior (o workflow guarda esse
    arquivo em cache entre as rodadas) e busca SO as que faltam pelo backend
    (/admin/ml_item_desc), no maximo DESC_POR_RODADA por vez pra rodada nao
    demorar. Em poucas rodadas todas as pecas ficam com descricao.
    """
    import concurrent.futures as cf
    antigos = {}
    old = SITE_DIR / "products.json"
    if old.exists():
        try:
            with open(old, encoding="utf-8") as f:
                for p in json.load(f).get("products", []):
                    if p.get("id") and p.get("desc"):
                        antigos[p["id"]] = p["desc"]
        except Exception as e:
            print(f"  ⚠ nao deu pra reler products.json: {e}")

    for p in products:
        p["desc"] = antigos.get(p["id"], "")

    faltam = [p for p in products if not p["desc"]]
    limite = int(os.getenv("DESC_POR_RODADA", "150"))
    if not ADMIN_KEY:
        print("⚠ ADMIN_KEY ausente: descricoes novas NAO foram buscadas")
    if ADMIN_KEY and faltam and limite > 0:
        h = {"X-Admin-Key": ADMIN_KEY}

        def pega(p):
            try:
                r = requests.get(f"{BACKEND}/admin/ml_item_desc", params={"mlb": p["id"]}, headers=h, timeout=20)
                if r.status_code == 200:
                    d = (r.json() or {}).get("data") or {}
                    return p, (d.get("plain_text") or "").strip()
            except Exception:
                pass
            return p, ""

        novos = 0
        with cf.ThreadPoolExecutor(max_workers=8) as ex:
            for p, txt in ex.map(pega, faltam[:limite]):
                if txt:
                    p["desc"] = txt
                    novos += 1
        print(f"Descricoes novas buscadas: {novos}/{min(len(faltam), limite)} (faltavam {len(faltam)})")
    print(f"Descricoes: {sum(1 for p in products if p['desc'])}/{len(products)}")
    return products

def save_products(products):
    """Salva o JSON do catálogo."""
    output = SITE_DIR / "products.json"

    # Ordenar por mais vendidos primeiro
    products.sort(key=lambda x: x.get("sold", 0), reverse=True)

    data = {
        "total": len(products),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "products": products
    }

    with open(output, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

    size_mb = output.stat().st_size / 1024 / 1024
    print(f"✅ Salvo em {output}")
    print(f"   {len(products)} produtos | {size_mb:.1f} MB")

def save_js_files(products):
    """Gera catalog_data.js (fallback do catalogo) e vitrine_data.js (home)."""
    compactos = [
        {"id": p["id"], "t": p["title"], "p": p["price"], "i": p["img"],
         "u": p["url"], "f": p["free_shipping"], "b": p["brand"]}
        for p in products if p.get("img")
    ]
    with open(SITE_DIR / "catalog_data.js", "w", encoding="utf-8") as f:
        f.write("const ALL_PRODUCTS = ")
        json.dump(compactos, f, ensure_ascii=False)
        f.write(";")

    vitrine = [{k: c[k] for k in ("t", "p", "i", "u", "f", "id")} for c in compactos[:40]]
    with open(SITE_DIR / "vitrine_data.js", "w", encoding="utf-8") as f:
        f.write("const VITRINE_DATA = ")
        json.dump(vitrine, f, ensure_ascii=False)
        f.write(";")

    print(f"catalog_data.js: {len(compactos)} | vitrine_data.js: {len(vitrine)}")


def save_seller_reputation():
    """Reputacao do vendedor (nivel do termometro, MercadoLider, vendas) -> reputation.json (raiz).

    A rota publica de usuarios do ML e chamada SEM token: o ML_ACCESS_TOKEN do .env local
    (Windows) nao existe no GitHub Actions. Qualquer falha (rede, bloqueio, resposta sem
    nivel ou sem vendas) mantem o reputation.json anterior. preparar_dados.py le este arquivo
    logo depois, para o selo de reputacao do site.
    """
    destino = SITE_DIR / "reputation.json"
    try:
        r = requests.get(f"https://api.mercadolibre.com/users/{SELLER_ID}", timeout=15)
        if r.status_code != 200:
            print(f"Reputacao: http {r.status_code} - mantendo o reputation.json anterior")
            return
        d = r.json()
        rep = d.get("seller_reputation") or {}
        tx = rep.get("transactions") or {}
        ratings = tx.get("ratings") or {}
        out = {
            "level_id": rep.get("level_id") or "",
            "power_seller_status": rep.get("power_seller_status") or "",
            "total_transactions": tx.get("total") or 0,
            "completed": tx.get("completed") or 0,
            "canceled": tx.get("canceled") or 0,
            "positive": ratings.get("positive") or 0,
            "neutral": ratings.get("neutral") or 0,
            "negative": ratings.get("negative") or 0,
            "nickname": d.get("nickname") or "",
            "registration_date": d.get("registration_date") or "",
        }
        if not out["level_id"] or not isinstance(out["completed"], int) or out["completed"] <= 0:
            print("Reputacao: resposta sem nivel/vendas - mantendo o reputation.json anterior")
            return
        tmp = destino.with_name(destino.name + ".tmp")
        tmp.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, destino)   # troca atomica: nunca fica arquivo pela metade
        print(f"Reputacao salva: {out['level_id']} / {out['power_seller_status'] or 'sem lider'} / {out['completed']} vendas concluidas")
    except Exception as e:   # reputacao nunca derruba a atualizacao do catalogo
        print(f"Reputacao: falhou ({e}) - mantendo o reputation.json anterior")

def main():
    print("=" * 50)
    print("  IZZAT CAR — Atualizador de Catálogo")
    print("=" * 50)
    print()

    raw = fetch_items_backend()
    if not raw:
        print("❌ Nenhum anúncio encontrado. Verifique ADMIN_KEY / backend.")
        return

    products = get_items_details(raw)
    products = get_items_descriptions(products)
    save_products(products)
    save_js_files(products)
    save_seller_reputation()

    print()
    print("🎉 PRONTO! O site já vai mostrar os anúncios atualizados.")
    print("   Rode este script sempre que quiser atualizar o catálogo.")

if __name__ == "__main__":
    main()
