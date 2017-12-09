// ----------------
// Cache Functions

function getCacheValue(key) {
  var cache = CacheService.getDocumentCache();
  return cache.get(key);
}

function delCacheValue(key) {
  var cache = CacheService.getDocumentCache();
  cache.remove(key);
}

function putCacheValue(key, value, expireSec) {
  if(typeof expireSec == "undefined") {
    expireSec = 86400;    // default cache 1 day
  }
  
  var cache = CacheService.getDocumentCache();
  cache.put(key, value, expireSec);
}

// ----------------

/**
 * Get MPF Price form AAStocks
 */
function AastocksMpfPrice(code, useCache) {
  if(typeof useCache == "undefined") {
    useCache = true;
  }
  
  var cacheKey = "aastocksmpf:" + code;
  
  if(useCache) {
    var cached = getCacheValue(cacheKey);
    if(cached != null) {
      return cached;
    }
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(60000);
  
  var html = UrlFetchApp.fetch("http://www.aastocks.com/tc/mpf/compare.aspx?comp1=" + code).getContentText();
  
  // e.g. <tr> <td>基金價格</td><td class="center cls">16.693</td><td class="cls"></td> </tr>
  var regExp = /<td>基金價格<\/td><td class='center cls'>(.*?)<\/td>/g;
  var value = regExp.exec(html)[1];
  var result = parseFloat(value);
  
  if(useCache) {
    putCacheValue(cacheKey, result);
  }
  
  lock.releaseLock();
  
  return result;
}

function testAastocksMpfPrice() {
  var price = AastocksMpfPrice('600341', false);
  Logger.log(price);
}

// ----------------

/**
 * Get MPF Info form MPF Express
 */
function ExpressMpfPage(code, useCache) {
  if(typeof useCache == "undefined") {
    useCache = true;
  }
  
  var cacheKey = "mpfex-html:" + code;
  if(useCache) {
    var cached = getCacheValue(cacheKey);
    if(cached != null) {
      return cached;
    }
  }
  
  var html = UrlFetchApp.fetch("http://www.mpfexpress.com/zh-HK/MPFSchemes/Fund/" + code).getContentText();

  if(useCache) {
    putCacheValue(cacheKey, html);
  }
  
  return html;
}

// ----------------
/**
 * Get MPF Current Info form MPF Express
 */
function ExpressMpfCurrent(code, useCache) {
  if(typeof useCache == "undefined") {
    useCache = true;
  }
  
  var cacheKey = "mpfex-price:" + code;
  if(useCache) {
    var cached = getCacheValue(cacheKey);
    if(cached != null) {
      return JSON.parse(cached);
    }
  }
  
  var html = ExpressMpfPage(code, useCache);
  
  // e.g. <tr><th align="left" valign="top">基金單位價格:</th><td align="left" valign="top">HK$19.6200 截至於 14/11/2017</td>
  var regExp = /HK\$(.*?) 截至於 (\d+\/\d+\/\d+)/g;
  var regResult = regExp.exec(html);
  Logger.log(regResult);
  var price = regResult[1];
  var priceDate = regResult[2];
  var result = {
    price: parseFloat(price),
    date: priceDate
  };
  
  if(useCache) {
    putCacheValue(cacheKey, JSON.stringify(result));
  }
  
  return result;
}

function testExpressMpfCurrent() {
  var mpf = ExpressMpfCurrent('380', false);
  Logger.log(mpf); 
}

/**
 * Get MPF Price form MPF Express
 */
function ExpressMpfPrice(code) {
  var mpf = ExpressMpfCurrent(code);
  return mpf.price;
}

/**
 * Get MPF Valuation Price form MPF Express
 */
function ExpressMpfDate(code) {
  var mpf = ExpressMpfCurrent(code);
  return mpf.date;
}

// ----------------
/**
 * Get MPF Launch Info form MPF Express
 */
function ExpressMpfLaunch(code, useCache) {
  if(typeof useCache == "undefined") {
    useCache = true;
  }
  
  var cacheKey = "mpfex-price:" + code;
  if(useCache) {
    var cached = getCacheValue(cacheKey);
    if(cached != null) {
      return JSON.parse(cached);
    }
  }
  
  var html = ExpressMpfPage(code, useCache);

  // 發行日期(日／月／年):  
  var regExp = /HK\$(.*?) 截至於 (\d+\/\d+\/\d+)/g;
  var regResult = regExp.exec(html);
  var price = regResult[1];
  var priceDate = regResult[2];
  var result = {
    price: parseFloat(price),
    date: priceDate
  };
  
  if(useCache) {
    putCacheValue(cacheKey, JSON.stringify(result));
  }
  
  return result;
}

// ----------------

/**
 * Get MPF Performance form MPF Express
 */
function ExpressMpfPerformance(code, useCache) {
  code = code.toString();
  
  if(typeof useCache == "undefined") {
    useCache = true;
  }
  
  var cacheKey = "mpfex-pm:" + code;
  if(useCache) {
    var cached = getCacheValue(cacheKey);
    if(cached != null) {
      return JSON.parse(cached);
    }
  }
  
  var formData = {
    'function': 'getPerformanceTable',
    'locale': 'zh-HK',
    'idStr': code,
    'isShowFundName': 0,
    'isShowBenchmark': 1
  };
  
  var options = {
    'method' : 'post',
    'payload' : formData
  };
  var html = UrlFetchApp.fetch('http://www.mpfexpress.com/Scripts/ajaxChart.aspx', options).getContentText();
  html = html.replace(',}', '}');  // fix the invalid json format from MPF Express
  var obj = JSON.parse(html);
  
  if(useCache) {
    putCacheValue(cacheKey, html);
  }
  
  return obj;
}

function testExpressMpfPf3m() {
  var code = 303;
  var cacheKey = "mpfex-pm:" + code.toString();
  
  var pf = ExpressMpfPerformance(code);
  Logger.log(pf);

  pf = ExpressMpfPf3m(code);
  Logger.log(pf);
  
  delCacheValue(cacheKey);
}

// MPF Return in 3 months
function ExpressMpfReturn3m(code) {
  var pf = ExpressMpfPerformance(code);
  return pf[0].Big[1].Return_Big_Tr_Value_3m;
}

// MPF Return in 1 year
function ExpressMpfReturn1y(code) {
  var pf = ExpressMpfPerformance(code);
  return pf[0].Big[1].Return_Big_Tr_Value_1yr; 
}

// MPF Return in 3 years
function ExpressMpfReturn3y(code) {
  var pf = ExpressMpfPerformance(code);
  return pf[0].Big[1].Return_Big_Tr_Value_3yr; 
}

// MPF Risk in 3 years
function ExpressMpfRisk3y(code) {
  var pf = ExpressMpfPerformance(code);
  return pf[0].Big[1].Return_Big_Tr_Value_3yrRisk; 
}

// MPF Return in 5 years
function ExpressMpfReturn5y(code) {
  var pf = ExpressMpfPerformance(code);
  return pf[0].Big[1].Return_Big_Tr_Value_5yr; 
}

// MPF Risk in 5 years
function ExpressMpfRisk3y(code) {
  var pf = ExpressMpfPerformance(code);
  return pf[0].Big[1].Return_Big_Tr_Value_5yrRisk; 
}

// MPF Return since launch
function ExpressMpfReturnSl(code) {
  var pf = ExpressMpfPerformance(code);
  return pf[0].Big[1].Return_Big_Tr_Value_sl; 
}

// ----------------

/**
 * Get MPF Year Performance form MPF Express
 */
function ExpressMpfYearPerformance(code, useCache) {
  code = code.toString();
  
  if(typeof useCache == "undefined") {
    useCache = true;
  }
  
  var cacheKey = "mpfex-yr-pm:" + code;
  if(useCache) {
    var cached = getCacheValue(cacheKey);
    if(cached != null) {
      return JSON.parse(cached);
    }
  }
  
  var formData = {
    'function': 'getYearPerformanceTable',
    'locale': 'zh-HK',
    'idStr': code,
    'isShowFundName': 0,
    'isShowBenchmark': 1
  };
  
  var options = {
    'method' : 'post',
    'payload' : formData
  };
  var html = UrlFetchApp.fetch('http://www.mpfexpress.com/Scripts/ajaxChart.aspx', options).getContentText();
  html = html.replace(',}', '}');  // fix the invalid json format from MPF Express
  var obj = JSON.parse(html);
  
  if(useCache) {
    putCacheValue(cacheKey, html);
  }
  
  return obj;
}

function testExpressMpfYearPerformance() {
  var code = 303;
  var pm = ExpressMpfYearPerformance(code, true);
  Logger.log(pm);
  Logger.log(pm[0].YearPerformanceTable[2].year);
}

// MPF Year 
function ExpressMpfYr(code, index) {
  if(typeof index == "undefined") {
    index = 1;
  }
  
  var pf = ExpressMpfYearPerformance(code);
  return pf[0].YearPerformanceTable[index + 1].year.replace('YTD ', '');
}

// MPF Return in Year
function ExpressMpfYrReturn(code, index) {
  if(typeof index == "undefined") {
    index = 1;
  }

  var pf = ExpressMpfYearPerformance(code);
  return pf[0].YearPerformanceTable[index + 1].fund_return;
}

