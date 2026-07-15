# Graph Report - D:\wxcpyapp  (2026-07-15)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3605 nodes · 4374 edges · 124 communities (47 shown, 77 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 92 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `94d0b055`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118

## God Nodes (most connected - your core abstractions)
1. `Wx` - 317 edges
2. `Game` - 74 edges
3. `SoundEngine` - 44 edges
4. `CanvasContext` - 43 edges
5. `PhysicsEngine` - 41 edges
6. `DatabaseCommand` - 35 edges
7. `Animation` - 31 edges
8. `FileSystemManager` - 29 edges
9. `InnerAudioContext` - 26 edges
10. `MapContext` - 23 edges

## Surprising Connections (you probably didn't know these)
- `animateNumber()` --indirect_call--> `value()`  [INFERRED]
  public/js/animation.js → miniprogram/components/energy-bar/energy-bar.js
- `level()` --calls--> `levelColor()`  [EXTRACTED]
  miniprogram/components/badge/badge.js → miniprogram/utils/animation.js
- `animateNumber()` --indirect_call--> `value()`  [INFERRED]
  miniprogram/utils/animation.js → miniprogram/components/energy-bar/energy-bar.js
- `loadHistory()` --calls--> `levelColor()`  [EXTRACTED]
  miniprogram/pages/history/history.js → miniprogram/utils/animation.js
- `loadHistory()` --calls--> `formatDisplay()`  [EXTRACTED]
  miniprogram/pages/history/history.js → miniprogram/utils/date.js

## Import Cycles
- None detected.

## Communities (124 total, 77 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.00
Nodes (1505): AccessCompleteCallback, AccessFailCallback, AccessFailCallbackResult, AccessOption, AccessSuccessCallback, AccountInfo, AddCardCompleteCallback, AddCardFailCallback (+1497 more)

### Community 2 - "Community 2"
Cohesion: 0.01
Nodes (70): AnyArray, AnyFunction, AnyObject, Batch, CallFunctionData, DatabaseAggregateCommand, DatabaseProjectionCommand, DatabaseUpdateCommand (+62 more)

### Community 3 - "Community 3"
Cohesion: 0.02
Nodes (105): AdClose, AdError, AdLoad, AudioEnded, AudioError, AudioPause, AudioPlay, AudioTimeUpdate (+97 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (7): ParticleSystem, COLOR_PALETTE, SHAPE_TYPES, STRESS_ICONS, STRESS_LABELS, BGM_STYLES, SoundEngine

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (47): handler(), {
  jsonResponse,
  checkAuth,
  getCozeConfig,
  stringifyRow,
  cozeRequest,
  handleOptions,
  CONNECTOR_ID,
}, rowToUpdateFields(), handler(), { jsonResponse, checkAuth, getMinimaxConfig, handleOptions }, handler(), {
  jsonResponse,
  checkAuth,
  equalFilter,
  queryRecords,
  parseRecord,
  dedupeRanking,
  fetchSsrMap,
  handleOptions,
}, checkAuth() (+39 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (3): PhysicsEngine, CollectionReference, Query

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (42): animateNumber(), easeOutCubic(), levelColor(), scoreToStars(), appEl, bindTabBar(), copyShare(), homeState (+34 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (30): AllFullProperty, AllProperty, ClearAnimationOptions, ComponentOptions, Constructor, Data, DataOption, DefinitionFilter (+22 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (18): storage, fortuneService, loadProfile(), onCheckIn(), onShow(), storage, AVATARS, storage (+10 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (20): Constructor, CustomOption, Data, DataOption, GetCurrentPages, IAddToFavoritesContent, IAddToFavoritesOption, ICustomShareContent (+12 more)

### Community 14 - "Community 14"
Cohesion: 0.08
Nodes (7): easeProgress(), FLAVORS, FortuneLoadingRitual, runFortuneRitual(), stageForProgress(), STAGES, InstanceMethods

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (23): applyRankingList(), buildDateMeta(), buildPodium(), clampRankingDate(), enrichItem(), formatUpdatedAt(), fortuneService, getRankingCopy() (+15 more)

### Community 18 - "Community 18"
Cohesion: 0.10
Nodes (15): userId, userInfo, appendFortuneHistory(), get(), getCachedTodayFortune(), getLocalHistory(), getUserId(), getUserInfo() (+7 more)

### Community 19 - "Community 19"
Cohesion: 0.08
Nodes (25): ES2020, node_modules, ./**/*.ts, ./typings, compilerOptions, allowJs, allowSyntheticDefaultImports, alwaysStrict (+17 more)

### Community 21 - "Community 21"
Cohesion: 0.08
Nodes (23): lazyCodeLoading, pages, sitemapLocation, style, tabBar, backgroundColor, borderStyle, color (+15 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (23): config, DB_KEY_MAP, equalFilter(), getDatabaseId(), getToken(), insertFortuneRecord(), insertRecords(), insertUser() (+15 more)

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (22): buildRecord(), checkTodayOfficial(), coze, createDefaultUser(), doCheckIn(), fetchCloudRanking(), generateAndSave(), getHistory() (+14 more)

### Community 24 - "Community 24"
Cohesion: 0.09
Nodes (22): matter-js, miniprogram-api-typings, @netlify/blobs, netlify-cli, author, dependencies, matter-js, @netlify/blobs (+14 more)

### Community 25 - "Community 25"
Cohesion: 0.13
Nodes (19): checkToday(), fortuneService, goResult(), initStars(), onBallTap(), onRegenerate(), onShow(), ritualUtil (+11 more)

### Community 28 - "Community 28"
Cohesion: 0.22
Nodes (18): apiRequest(), nowTimestamp(), today(), buildRecord(), checkTodayOfficial(), createDefaultUser(), doCheckIn(), fetchCloudRanking() (+10 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (11): level(), { levelColor }, { animateNumber }, value(), { animateNumber, scoreToStars, levelColor }, onLoad(), startReveal(), animateNumber() (+3 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (15): buildUserPrompt(), clampScore(), clampScoreToLevel(), config, generateFortune(), LEVEL_SCORE_RANGE, LEVEL_WEIGHTS, mockFortune() (+7 more)

### Community 31 - "Community 31"
Cohesion: 0.11
Nodes (12): Constructor, GetApp, GetAppOption, Instance, LaunchShowOption, Option, Options, PageNotFoundOption (+4 more)

### Community 32 - "Community 32"
Cohesion: 0.25
Nodes (16): DB_KEY_MAP, equalFilter(), insertFortuneRecord(), insertRecords(), insertUser(), orFilter(), proxyAction(), queryFortuneByUserAndDate() (+8 more)

### Community 35 - "Community 35"
Cohesion: 0.12
Nodes (16): BehaviorIdentifier, Constructor, Data, DataOption, DefinitionFilter, Instance, Lifetimes, Method (+8 more)

### Community 36 - "Community 36"
Cohesion: 0.20
Nodes (15): bindRankingDateNav(), buildPodium(), buildRankingDateNav(), changeRankingDate(), clampRankingDate(), formatUpdatedAt(), getRankingCopy(), getRoute() (+7 more)

### Community 37 - "Community 37"
Cohesion: 0.26
Nodes (14): buildUserPrompt(), clampScore(), clampScoreToLevel(), extractContent(), generateFortune(), LEVEL_SCORE_RANGE, LEVEL_WEIGHTS, mockFortune() (+6 more)

### Community 38 - "Community 38"
Cohesion: 0.29
Nodes (14): addFiles(), api(), compressImage(), escapeHtml(), fileToDataUrl(), imageToCanvas(), initUpload(), pollTask() (+6 more)

### Community 43 - "Community 43"
Cohesion: 0.15
Nodes (13): CallFunctionResult, DeleteFileResult, DownloadFileResult, GetTempFileURLResult, IAddResult, IAPISuccessParam, ICountResult, IQueryResult (+5 more)

### Community 49 - "Community 49"
Cohesion: 0.22
Nodes (4): __dir, results, root, today

### Community 52 - "Community 52"
Cohesion: 0.29
Nodes (5): { formatDisplay }, fortuneService, { levelColor }, loadHistory(), onShow()

### Community 59 - "Community 59"
Cohesion: 0.29
Nodes (6): AsyncMethodOptionLike, IAnyObject, Optional, OptionalInterface, PromisifySuccessResult, WechatMiniprogram

### Community 66 - "Community 66"
Cohesion: 0.29
Nodes (7): CallFunctionParam, DeleteFileParam, DownloadFileParam, GetTempFileURLParam, IAPIParam, ICloudAPIParam, UploadFileParam

### Community 67 - "Community 67"
Cohesion: 0.29
Nodes (7): IAddDocumentOptions, IDBAPIParam, IRemoveDocumentOptions, ISetDocumentOptions, ISetSingleDocumentOptions, IUpdateDocumentOptions, IUpdateSingleDocumentOptions

### Community 77 - "Community 77"
Cohesion: 0.60
Nodes (4): config, getProxyBase(), proxyRequest(), useProxy()

### Community 96 - "Community 96"
Cohesion: 0.50
Nodes (4): BaseEvent, CustomEvent, Touch, TouchCanvas

## Knowledge Gaps
- **1892 isolated node(s):** `storage`, `pages/welcome/welcome`, `pages/home/home`, `pages/result/result`, `pages/history/history` (+1887 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **77 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Wx` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `VideoContext` connect `Community 45` to `Community 0`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `InnerAudioContext` connect `Community 20` to `Community 0`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `storage`, `pages/welcome/welcome`, `pages/home/home` to the rest of the system?**
  _1892 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0013280212483399733 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.006309148264984227 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.011428571428571429 - nodes in this community are weakly interconnected._