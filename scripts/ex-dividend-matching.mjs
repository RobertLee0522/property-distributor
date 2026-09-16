// 配息表只給「發放日」，但能不能領到一次配息看的是「除息交易日」，兩者通常差三到
// 四週。這裡負責把官方除權息日曆上的除息日，配對回每一筆配息紀錄。
//
// 同一檔的配息金額常常重複（例如 00929 連續三次都配 0.38），所以由舊到新逐筆認領、
// 認領過的除息日不再重複使用，才不會把某次除息配到相鄰的另一次發放。配不到的就不
// 寫 exDate，前端會退回只看發放日的寬鬆判斷。
export function attachExDates(code, dividends, exIndex) {
  const candidates = (exIndex.get(code) ?? []).map((item) => ({
    ...item,
    claimed: false,
  }));
  if (candidates.length === 0) return dividends;

  const exDateByPayment = new Map();
  const oldestFirst = [...dividends].sort((a, b) =>
    a.paymentDate < b.paymentDate ? -1 : 1,
  );

  for (const dividend of oldestFirst) {
    let match;
    for (const candidate of candidates) {
      if (candidate.claimed) continue;
      if (candidate.exDate >= dividend.paymentDate) continue;
      if (Math.abs(candidate.amount - dividend.amount) > 0.0005) continue;
      if (!match || candidate.exDate > match.exDate) match = candidate;
    }
    if (!match) continue;
    match.claimed = true;
    exDateByPayment.set(dividend.paymentDate, match.exDate);
  }

  return dividends.map((dividend) => {
    const exDate = exDateByPayment.get(dividend.paymentDate);
    return exDate ? { ...dividend, exDate } : dividend;
  });
}
