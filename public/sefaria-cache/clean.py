#!/usr/bin/env python3
import json
import os

TARGET_PREFIX = "works/Mishnah/Acharonim on Mishnah/"

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    catalog_path = os.path.join(script_dir, "catalog.json")

    if not os.path.exists(catalog_path):
        print(f"Файл catalog.json не найден: {catalog_path}")
        return

    with open(catalog_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Поддержка двух вариантов структуры:
    # 1) {"works": [ ... ]}
    # 2) [ ... ]
    if isinstance(data, dict) and isinstance(data.get("works"), list):
        works = data["works"]
        root_is_dict = True
    elif isinstance(data, list):
        works = data
        root_is_dict = False
    else:
        raise ValueError("Неожиданная структура JSON: ожидается либо объект с ключом 'works', либо список.")

    before = len(works)

    # Что реально будет удалено
    to_remove = [
        w for w in works
        if isinstance(w, dict)
        and isinstance(w.get("path"), str)
        and w["path"].startswith(TARGET_PREFIX)
    ]

    if not to_remove:
        print(f"❌ Не найдено ни одного пути, начинающегося с '{TARGET_PREFIX}'")

        # Покажем несколько примеров path для ориентира
        print("\nПримеры path из файла (первые 20):")
        count = 0
        for w in works:
            if isinstance(w, dict) and "path" in w:
                print(" ", w["path"])
                count += 1
                if count >= 20:
                    break

        # Покажем всё, где вообще есть 'Acharonim on Mishnah'
        print("\nВсе пути, содержащие 'Acharonim on Mishnah':")
        found = False
        for w in works:
            if isinstance(w, dict) and isinstance(w.get("path"), str):
                if "Acharonim on Mishnah" in w["path"]:
                    print(" ", w["path"])
                    found = True
        if not found:
            print("  (нет таких)")

        return

    # Если нашли — реально удаляем
    works = [
        w for w in works
        if not (
            isinstance(w, dict)
            and isinstance(w.get("path"), str)
            and w["path"].startswith(TARGET_PREFIX)
        )
    ]
    removed = before - len(works)

    # Собираем обратно data в том же формате, что был
    if root_is_dict:
        data["works"] = works
    else:
        data = works

    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Готово ✅ Удалено записей: {removed}. Осталось: {len(works)}.")

if __name__ == "__main__":
    main()
