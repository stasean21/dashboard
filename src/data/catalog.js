export const emptyCatalogState = () => ({
  version: 1,
  links: [],
  reviews: {},
  separated: [],
  cards: {},
});
export const normalizeArticle = (value) =>
  String(value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ru");
export const offerId = (marketplace, accountId, sku) =>
  `${marketplace}:${accountId || "default"}:${sku}`;
const signature = (ids, offers) =>
  JSON.stringify(
    [...ids].sort().map((id) => {
      const o = offers.get(id);
      return [id, o?.article, o?.deleted || false];
    }),
  );
const safePhotos = (value) =>
  (Array.isArray(value) ? value : []).filter(
    (url) =>
      typeof url === "string" &&
      (/^https:\/\//.test(url) || /^\/media\//.test(url)),
  );

export function catalogOffers(ozon, wb) {
  const latest = new Map();
  for (const row of ozon?.rows || []) {
    const old = latest.get(String(row.sku));
    if (!old || row.date >= old.date) latest.set(String(row.sku), row);
  }
  const result = [];
  for (const [marketplace, report, rows] of [
    ["ozon", ozon, [...latest.values()]],
    ["wb", wb, wb?.rows || []],
  ]) {
    for (const row of rows) {
      const id = offerId(marketplace, report.accountId, String(row.sku));
      result.push({
        ...row,
        id,
        sku: String(row.sku),
        marketplace,
        accountId: report.accountId || "default",
        article: String(row.article || ""),
        deleted: !!row.deleted,
        photos: safePhotos(row.photos),
        period: {
          start: report.minDate || report.start,
          end: report.maxDate || report.end,
        },
        fileName: report.fileName,
      });
    }
  }
  return result;
}

export function buildCatalog(ozon, wb, state = emptyCatalogState()) {
  const offerList = catalogOffers(ozon, wb),
    offers = new Map(offerList.map((o) => [o.id, o]));
  const byArticle = new Map(),
    byBase = new Map();
  for (const o of offerList) {
    const key = normalizeArticle(o.article);
    if (!key) continue;
    if (!byArticle.has(key)) byArticle.set(key, []);
    byArticle.get(key).push(o.id);
    const base = key.replace(/\/+$/, "");
    if (base) {
      if (!byBase.has(base)) byBase.set(base, []);
      byBase.get(base).push(o.id);
    }
  }
  const checks = [];
  function addCheck(kind, key, ids) {
    const id = `${kind}:${key}`,
      sig = signature(ids, offers),
      source = ids.map((id) => offers.get(id));
    const name =
      source.find((o) => o.marketplace === "wb" && !o.deleted)?.name ||
      source[0].name;
    checks.push({
      id,
      kind,
      offerIds: ids,
      name,
      signature: sig,
      resolved: state.reviews[id]?.signature === sig,
      severity: kind === "deleted" ? "info" : "review",
      title:
        kind === "duplicate"
          ? "Повтор артикула у нескольких карточек"
          : kind === "article"
            ? "Разное написание артикула"
            : "Карточка WB помечена удалённой",
      article: [...new Set(source.map((o) => o.article))].join(" · "),
    });
  }
  for (const [key, ids] of byArticle) {
    const counts = new Map();
    for (const id of ids) {
      const o = offers.get(id),
        scope = `${o.marketplace}:${o.accountId}`;
      counts.set(scope, (counts.get(scope) || 0) + 1);
    }
    if ([...counts.values()].some((n) => n > 1))
      addCheck("duplicate", key, ids);
  }
  for (const [key, ids] of byBase)
    if (
      ids.length > 1 &&
      new Set(ids.map((id) => normalizeArticle(offers.get(id).article))).size >
        1
    )
      addCheck("article", key, ids);
  for (const o of offerList)
    if (o.marketplace === "wb" && o.deleted) addCheck("deleted", o.id, [o.id]);

  const rows = [],
    used = new Set(),
    owner = new Map();
  const primary = (ids) =>
    ids.find((id) => offers.get(id).marketplace === "ozon") || ids[0];
  function addRow(ids, status, id = primary(ids)) {
    const items = ids.map((key) => offers.get(key)),
      representative =
        items.find((o) => o.marketplace === "wb" && !o.deleted) || items[0];
    const row = {
      id,
      offerIds: ids,
      offers: items,
      status,
      name: representative.name,
      articles: [...new Set(items.map((o) => o.article))],
      checks: [],
    };
    rows.push(row);
    for (const key of ids) {
      used.add(key);
      owner.set(key, row);
    }
    return row;
  }
  for (const link of state.links) {
    const ids = link.offerIds.filter((id) => offers.has(id) && !used.has(id));
    if (ids.length) {
      const row = addRow(ids, "linked", link.id);
      row.missingOfferIds = link.offerIds.filter((id) => !offers.has(id));
    }
  }
  // Review groups are visual proposals, never automatic confirmed links.
  for (const check of checks.filter(
    (i) => !i.resolved && i.kind !== "deleted",
  )) {
    const ids = check.offerIds.filter((id) => !used.has(id));
    if (!ids.length) continue;
    const related = rows.filter(
      (row) =>
        row.status === "review" &&
        row.offerIds.some((id) => check.offerIds.includes(id)),
    );
    if (related.length) {
      const row = related[0];
      row.offerIds.push(...ids);
      row.offers.push(...ids.map((id) => offers.get(id)));
      row.articles = [...new Set(row.offers.map((o) => o.article))];
      for (const id of ids) {
        used.add(id);
        owner.set(id, row);
      }
    } else addRow(ids, "review");
  }
  const separated = (ids) =>
    state.separated.some(
      (entry) =>
        entry.signature ===
          signature(
            entry.offerIds.filter((id) => offers.has(id)),
            offers,
          ) && ids.every((id) => entry.offerIds.includes(id)),
    );
  let candidates = 0;
  for (const ids of byArticle.values()) {
    if (
      ids.length !== 2 ||
      new Set(ids.map((id) => offers.get(id).marketplace)).size !== 2
    )
      continue;
    candidates++;
    if (!ids.some((id) => used.has(id)) && !separated(ids))
      addRow(ids, "candidate");
  }
  for (const o of [...offerList].sort(
    (a, b) =>
      (a.marketplace === "wb" ? 0 : 1) - (b.marketplace === "wb" ? 0 : 1),
  ))
    if (!used.has(o.id)) addRow([o.id], "single");
  for (const check of checks)
    for (const id of check.offerIds) {
      const row = owner.get(id);
      if (row && !row.checks.some((i) => i.id === check.id))
        row.checks.push(check);
    }
  const priority = (row) =>
    row.checks.some((c) => !c.resolved && c.kind === "duplicate")
      ? 0
      : row.checks.some((c) => !c.resolved && c.kind === "article")
        ? 1
        : row.checks.some((c) => !c.resolved)
          ? 2
          : 3;
  const wbOrder = new Map((wb?.rows || []).map((o, i) => [String(o.sku), i]));
  const order = (row) =>
    Math.min(
      ...row.offers.map((o) =>
        o.marketplace === "wb" ? wbOrder.get(o.sku) : 100000,
      ),
    );
  rows.sort(
    (a, b) =>
      priority(a) - priority(b) ||
      order(a) - order(b) ||
      a.name.localeCompare(b.name, "ru"),
  );
  return {
    rows,
    checks,
    offers,
    owner,
    candidates,
    sourceCounts: {
      ozon: latestCount(offerList, "ozon"),
      wb: latestCount(offerList, "wb"),
    },
  };
}
const latestCount = (offers, market) =>
  offers.filter((o) => o.marketplace === market).length;
export const checksForMarket = (catalog, marketplace) =>
  catalog.checks.filter(
    (i) =>
      marketplace === "all" ||
      i.offerIds.some(
        (id) => catalog.offers.get(id)?.marketplace === marketplace,
      ),
  );
export const rowsForMarket = (catalog, marketplace) =>
  catalog.rows.filter(
    (r) =>
      marketplace === "all" ||
      r.offers.some((o) => o.marketplace === marketplace),
  );

export function linkCatalogOffers(state, row, ids, catalog) {
  const unique = [...new Set(ids)];
  if (unique.length < 2 || unique.some((id) => !catalog.offers.has(id)))
    throw new Error("Выберите минимум две существующие карточки.");
  if (
    state.links.some(
      (link) =>
        link.id !== row.id && link.offerIds.some((id) => unique.includes(id)),
    )
  )
    throw new Error(
      "Карточка уже привязана к другому товару. Сначала разъедините эту связь.",
    );
  return {
    ...state,
    links: [
      ...state.links.filter((link) => link.id !== row.id),
      { id: row.id, offerIds: unique },
    ],
  };
}
export function resolveCatalogCheck(state, check, decision, catalog) {
  let next = state;
  const row = catalog.owner.get(
    check.offerIds.find(
      (id) => catalog.offers.get(id).marketplace === "ozon",
    ) || check.offerIds[0],
  );
  if (decision === "together")
    next = linkCatalogOffers(state, row, check.offerIds, catalog);
  else if (decision === "active") {
    const ids = check.offerIds.filter((id) => !catalog.offers.get(id).deleted);
    next = linkCatalogOffers(state, row, ids, catalog);
  } else if (decision === "separate")
    next = {
      ...state,
      links: state.links.filter(
        (link) => !link.offerIds.some((id) => check.offerIds.includes(id)),
      ),
      separated: [
        ...state.separated.filter((s) => s.id !== check.id),
        { id: check.id, offerIds: check.offerIds, signature: check.signature },
      ],
    };
  else if (check.kind !== "deleted")
    throw new Error("Выберите решение для карточек.");
  return {
    ...next,
    reviews: {
      ...next.reviews,
      [check.id]: { signature: check.signature, decision },
    },
  };
}
export const reopenCatalogCheck = (state, check) => {
  const reviews = { ...state.reviews };
  delete reviews[check.id];
  return {
    ...state,
    reviews,
    separated: state.separated.filter((s) => s.id !== check.id),
  };
};
export const unlinkCatalogRow = (state, row) => ({
  ...state,
  links: state.links.filter((l) => l.id !== row.id),
  separated: [
    ...state.separated.filter((s) => s.id !== `unlink:${row.id}`),
    {
      id: `unlink:${row.id}`,
      offerIds: row.offerIds,
      signature: signature(
        row.offerIds,
        new Map(row.offers.map((o) => [o.id, o])),
      ),
    },
  ],
});
export function costToMinor(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!text) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error(
      "Введите сумму от 0 ₽, не больше двух знаков после запятой.",
    );
  const [whole, fraction = ""] = text.split("."),
    amount = Number(whole + fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount)) throw new Error("Сумма слишком велика.");
  return amount;
}
export const costInput = (minor) =>
  minor == null
    ? ""
    : `${Math.floor(minor / 100)},${String(minor % 100).padStart(2, "0")}`;
