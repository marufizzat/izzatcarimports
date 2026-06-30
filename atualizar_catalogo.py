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
SITE_DIR = Path(r"C:\Users\Administrator\Desktop\IzzatCar\site")

headers = {"Authorization": f"Bearer {TOKEN}"}

def refresh_token():
    """Tenta renovar o token se expirado."""
    refresh = os.getenv("REFRESH_TOKEN")
    app_id = os.getenv("APP_ID", "5532196899096674")
    client_secret = os.getenv("CLIENT_SECRET")
    if not refresh or not client_secret:
        print("⚠ Sem REFRESH_TOKEN ou CLIENT_SECRET no .env")
        return None
    resp = requests.post("https://api.mercadolibre.com/oauth/token", json={
        "grant_type": "refresh_token",
        "client_id": app_id,
        "client_secret": client_secret,
        "refresh_token": refresh
    })
    if resp.status_code == 200:
        data = resp.json()
        new_token = data["access_token"]
        # Atualizar .env
        env_content = env_path.read_text()
        env_content = env_content.replace(TOKEN, new_token)
        if "REFRESH_TOKEN" in env_content:
            old_refresh = refresh
            env_content = env_content.replace(old_refresh, data.get("refresh_token", old_refresh))
        env_path.write_text(env_content)
        print("✅ Token renovado!")
        return new_token
    print(f"❌ Erro ao renovar token: {resp.status_code}")
    return None

def get_all_item_ids():
    """Busca todos os IDs de anuncios ativos. Usa offset ate 1000, depois scroll_id."""
    print("📦 Buscando IDs dos anúncios...")
    ids = []
    limit = 100
    total = 0

    # Fase 1: offset normal (0-999)
    for offset in range(0, 1000, limit):
        url = f"https://api.mercadolibre.com/users/{SELLER_ID}/items/search?status=active&limit={limit}&offset={offset}"
        resp = requests.get(url, headers=headers)
        if resp.status_code == 401:
            new_token = refresh_token()
            if new_token:
                headers["Authorization"] = f"Bearer {new_token}"
                resp = requests.get(url, headers=headers)
            else:
                break
        data = resp.json()
        batch = data.get("results", [])
        total = data.get("paging", {}).get("total", 0)
        ids.extend(batch)
        print(f"  {len(ids)}/{total} IDs...")
        if not batch or len(ids) >= total:
            break
        time.sleep(0.2)

    # Fase 2: scroll para pegar alem de 1000
    if len(ids) < total:
        print(f"  Usando scroll para {total - len(ids)} restantes...")
        scroll_url = f"https://api.mercadolibre.com/users/{SELLER_ID}/items/search?status=active&search_type=scan&limit={limit}"
        resp = requests.get(scroll_url, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            scroll_id = data.get("scroll_id")
            batch = data.get("results", [])
            # Adicionar apenas os que nao temos
            existing = set(ids)
            for b in batch:
                if b not in existing:
                    ids.append(b)
                    existing.add(b)

            while scroll_id and len(ids) < total:
                scroll_url2 = f"https://api.mercadolibre.com/users/{SELLER_ID}/items/search?status=active&search_type=scan&limit={limit}&scroll_id={scroll_id}"
                resp2 = requests.get(scroll_url2, headers=headers)
                if resp2.status_code != 200:
                    break
                data2 = resp2.json()
                batch2 = data2.get("results", [])
                scroll_id = data2.get("scroll_id")
                if not batch2:
                    break
                for b in batch2:
                    if b not in existing:
                        ids.append(b)
                        existing.add(b)
                print(f"  {len(ids)}/{total} IDs (scroll)...")
                time.sleep(0.3)

    print(f"✅ {len(ids)} IDs encontrados")
    return ids

def upscale_img(url):
    if not url:
        return url
    url = url.replace("http:", "https:")
    if "-I.jpg" in url:
        url = url.replace("-I.jpg", "-O.webp")
    elif "-I.webp" in url:
        url = url.replace("-I.webp", "-O.webp")
    return url

def get_items_details(ids):
    """Busca detalhes dos itens em lotes de 20. Agora salva pictures[], attributes, sold."""
    print("Buscando detalhes dos anuncios...")
    products = []
    for i in range(0, len(ids), 20):
        batch = ids[i:i+20]
        batch_str = ",".join(batch)
        url = f"https://api.mercadolibre.com/items?ids={batch_str}"
        resp = requests.get(url, headers=headers)
        if resp.status_code == 401:
            new_token = refresh_token()
            if new_token:
                headers["Authorization"] = f"Bearer {new_token}"
                resp = requests.get(url, headers=headers)
        if resp.status_code == 200:
            items = resp.json()
            for item_wrapper in items:
                item = item_wrapper.get("body", {})
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
                }
                products.append(product)

        done = min(i + 20, len(ids))
        print(f"  {done}/{len(ids)} detalhes...")
        time.sleep(0.3)  # Rate limit

    print(f"{len(products)} produtos processados")
    return products

def get_items_descriptions(products):
    """Busca descricao plain_text de cada item. Chamada separada por item."""
    print("Buscando descricoes...")
    for idx, p in enumerate(products):
        if idx % 50 == 0:
            print(f"  {idx}/{len(products)} descricoes...")
        try:
            r = requests.get(f"https://api.mercadolibre.com/items/{p['id']}/description", headers=headers, timeout=15)
            if r.status_code == 401:
                new_token = refresh_token()
                if new_token:
                    headers["Authorization"] = f"Bearer {new_token}"
                    r = requests.get(f"https://api.mercadolibre.com/items/{p['id']}/description", headers=headers, timeout=15)
            if r.status_code == 200:
                p["desc"] = r.json().get("plain_text", "")
            else:
                p["desc"] = ""
        except Exception as e:
            p["desc"] = ""
        time.sleep(0.08)
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

def save_seller_reputation():
    """Busca reputacao do vendedor e salva em reputation.json pra exibir no site."""
    try:
        r = requests.get(f"https://api.mercadolibre.com/users/{SELLER_ID}", headers=headers, timeout=15)
        if r.status_code == 200:
            d = r.json()
            rep = d.get("seller_reputation", {})
            metrics = rep.get("transactions", {}).get("ratings", {})
            out = {
                "level_id": rep.get("level_id", ""),
                "power_seller_status": rep.get("power_seller_status", ""),
                "total_transactions": rep.get("transactions", {}).get("total", 0),
                "completed": rep.get("transactions", {}).get("completed", 0),
                "canceled": rep.get("transactions", {}).get("canceled", 0),
                "positive": metrics.get("positive", 0),
                "neutral": metrics.get("neutral", 0),
                "negative": metrics.get("negative", 0),
                "nickname": d.get("nickname", ""),
                "registration_date": d.get("registration_date", ""),
            }
            with open(SITE_DIR / "reputation.json", "w", encoding="utf-8") as f:
                json.dump(out, f, ensure_ascii=False, indent=2)
            print(f"Reputacao salva: {out['level_id']} / {out['total_transactions']} vendas / {out['positive']*100:.0f}% positivas")
    except Exception as e:
        print(f"Erro reputacao: {e}")

def main():
    print("=" * 50)
    print("  IZZAT CAR — Atualizador de Catálogo")
    print("=" * 50)
    print()

    ids = get_all_item_ids()
    if not ids:
        print("❌ Nenhum anúncio encontrado. Verifique o token.")
        return

    products = get_items_details(ids)
    products = get_items_descriptions(products)
    save_products(products)
    save_seller_reputation()

    print()
    print("🎉 PRONTO! O site já vai mostrar os anúncios atualizados.")
    print("   Rode este script sempre que quiser atualizar o catálogo.")

if __name__ == "__main__":
    main()
