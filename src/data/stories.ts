import type { Story } from "../lib/types";

// 經典情節的獨立繁體中文重述；參考版本與編寫原則見 docs/story-sources.md。
// facts 僅列揭曉所需的隱藏關鍵；未設定的枝節不應被主持人補寫成真相。
export const stories: Story[] = [
  {
    id: "elevator",
    title: "雨天才到得了的樓層",
    premise:
      "他住在十樓，每次出門都能搭電梯直達一樓。可是，晴天獨自回家時，他通常在七樓就離開電梯，走樓梯上去；下雨天獨自回家，卻能直接搭到十樓。同一部電梯一直運作正常，差別在哪裡？",
    solution:
      "問題出在按鈕的位置。他個子矮，伸手搆不到十樓的按鈕；一樓的按鈕按得到，往上則最多只能按到七樓。晴天他通常沒帶傘，獨自回來就先搭到七樓，再走樓梯。雨天他會帶傘，回家時便用傘尖按下十樓的按鈕。讓他少走幾層樓的，是手上的雨傘。",
    difficulty: "入門",
    mood: "日常",
    minutes: 5,
    motif: "elevator",
    tags: ["日常觀察", "換個角度"],
    facts: [
      { id: "elevator-reach", text: "他因為個子矮，伸手搆不到十樓的電梯按鈕。" },
      { id: "elevator-lower-buttons", text: "他搆得到的樓層按鈕範圍是一樓到七樓。" },
      { id: "elevator-rain-item", text: "雨天回家時，他身上會帶著雨傘。" },
      { id: "elevator-umbrella-button", text: "他用雨傘延長觸及範圍，按下十樓的按鈕。" },
    ],
    hint: "先想想，搭電梯到某一層之前，乘客得做什麼。",
    sources: [
      {
        title: "Folj｜The Elevator Dilemma（經典情節・獨立重述）",
        url: "https://www.folj.com/puzzle-detail/38.htm",
      },
      {
        title: "Folj｜The Man on the Elivator，第 49 題（樓層設定參考）",
        url: "https://www.folj.com/puzzle-detail/300.htm",
      },
    ],
  },
  {
    id: "hiccups",
    title: "沒有喝到的水",
    premise:
      "一位客人走到吧檯前，只要一杯水。酒保沒倒水，反而拿出槍指著他。客人愣了一下，接著真心道謝，連水都沒喝就離開了。他為什麼謝謝酒保？",
    solution:
      "客人一直打嗝，要水是想讓打嗝停下來。酒保看出了他的困擾，拿槍指著他是為了嚇他。這一嚇，客人的打嗝停了；原本求水的原因已經消失，他便向酒保道謝離開。",
    difficulty: "入門",
    mood: "懸疑",
    minutes: 5,
    motif: "glass",
    tags: ["動機反轉", "經典短湯"],
    facts: [
      { id: "hiccups-water-purpose", text: "客人要水是為了解決一直打嗝的困擾。" },
      { id: "hiccups-bartender-purpose", text: "酒保拿槍的目的是嚇客人，讓他的打嗝停止。" },
      { id: "hiccups-stopped", text: "受到驚嚇後，客人的打嗝確實停止了。" },
    ],
    hint: "要一杯水，不一定是因為口渴。",
    sources: [
      {
        title: "Folj｜A Thankful Encounter at the Bar（經典情節・獨立重述）",
        url: "https://www.folj.com/puzzle-detail/615.htm",
      },
    ],
  },
  {
    id: "snowman",
    title: "留在水邊的帽子",
    premise:
      "陽光下的空地上，一頂毛帽、一根紅蘿蔔和幾顆小石頭散落在一灘水旁。沒有人把這些東西丟在地上，現場卻自然變成了這副模樣。它們原本在哪裡？",
    solution:
      "這裡原本站著一個雪人。毛帽、紅蘿蔔和小石頭都是放在雪人身上的裝飾，並不是被人隨手丟棄。天氣回暖，雪人在陽光下融化，變成地上的水；失去支撐的裝飾便留在原處。",
    difficulty: "入門",
    mood: "日常",
    minutes: 4,
    motif: "ice",
    tags: ["物件線索", "時間變化"],
    facts: [
      { id: "snowman-original", text: "空地上原本有一個雪人。" },
      { id: "snowman-decorations", text: "毛帽、紅蘿蔔和石頭原本都是雪人身上的裝飾。" },
      { id: "snowman-melted", text: "雪人受熱融化成水，使裝飾失去支撐而落地。" },
    ],
    hint: "眼前看得到的物品，也許曾依附在另一個東西上。",
    sources: [
      {
        title: "Folj｜早春空地上的物品，第 10 題（經典情節・獨立重述）",
        url: "https://www.folj.com/puzzle-detail/258.htm",
      },
    ],
  },
  {
    id: "hotel",
    title: "一到旅館就破產",
    premise:
      "他把自己的車往前推，停在一間旅館前。才剛到那裡，他就知道自己破產了。車子沒有壞，也沒有發生事故，為什麼一間旅館能讓他破產？",
    solution:
      "他正在玩大富翁桌遊，推動的是代表自己的汽車造型棋子。棋子停在另一位玩家蓋有旅館的地產格，依照規則得付租金。他的遊戲資產不足以清償這筆租金，因此在這一局裡破產。車與旅館都屬於棋盤上的遊戲情境。",
    difficulty: "入門",
    mood: "日常",
    minutes: 5,
    motif: "letter",
    tags: ["語意誤導", "場景轉換"],
    facts: [
      { id: "hotel-car-token", text: "他推動的車是大富翁桌遊裡代表自己的棋子。" },
      { id: "hotel-rent", text: "棋子停在對手蓋有旅館的地產格，必須支付遊戲租金。" },
      { id: "hotel-insufficient-assets", text: "他的遊戲資產不足以清償該筆租金。" },
    ],
    hint: "先確認，「車」和「旅館」的大小是不是你想像的那樣。",
    sources: [
      {
        title: "Folj｜推車到旅館，第 18 題（經典情節・獨立重述）",
        url: "https://www.folj.com/puzzle-detail/268.htm",
      },
    ],
  },
  {
    id: "coffee",
    title: "換過的咖啡？",
    premise:
      "客人發現咖啡裡有隻蒼蠅，請店員換一杯。店員把杯子收走，過一會兒送回沒有蒼蠅的咖啡，說已經換好了。客人喝了一口，便指出店員只撈掉蒼蠅，沒有換咖啡，而且他說對了。他喝出了什麼線索？",
    solution:
      "客人在發現蒼蠅之前，已經自己往咖啡裡加了糖。這裡重新沖好的咖啡本來不加糖，甜味要由客人自行添加。送回來的咖啡卻在他再次加糖前就帶著甜味：店員只撈走蒼蠅，連同先前溶進去的糖，把原本那杯送了回來。",
    difficulty: "進階",
    mood: "日常",
    minutes: 7,
    motif: "glass",
    tags: ["前後比較", "細節推理"],
    facts: [
      { id: "coffee-sugar-added", text: "客人在發現蒼蠅之前，已經親自往原本的咖啡裡加糖。" },
      { id: "coffee-fresh-unsweetened", text: "店家重新沖好的咖啡本來不加糖，由客人自行添加。" },
      { id: "coffee-returned-sweet", text: "送回來的咖啡在客人再次加糖前，就已經帶有甜味。" },
    ],
    hint: "他送回咖啡之前，可能做過一件店員沒注意的事。",
    sources: [
      {
        title: "Folj｜A Man in a Restaurant Complains to the Waiter（經典情節・獨立重述）",
        url: "https://www.folj.com/puzzle-detail/274.htm",
      },
    ],
  },
  {
    id: "phone",
    title: "不說話的電話",
    premise:
      "深夜，一名旅客在旅館床上翻來覆去，怎麼也睡不著。他拿起房內電話撥了一通，聽見對方接起，自己一句話也沒說就掛斷。放下話筒後，他很快睡著了。這通電話幫了什麼忙？",
    solution:
      "讓他睡不著的是隔壁房客的鼾聲。他打到隔壁房間，用電話鈴聲叫醒那位房客。對方既然醒來接電話，鼾聲也就暫時停了，所以旅客不必開口交談。他趁隔壁再度入睡、開始打鼾之前的安靜空檔，先睡著了。",
    difficulty: "進階",
    mood: "日常",
    minutes: 7,
    motif: "music",
    tags: ["聲音線索", "行為動機"],
    facts: [
      { id: "phone-snoring", text: "旅客睡不著，是因為隔壁房客的鼾聲。" },
      { id: "phone-wake-neighbor", text: "旅客撥到隔壁房間，利用電話鈴聲叫醒打鼾的人。" },
      { id: "phone-quiet-interval", text: "隔壁醒來後鼾聲暫停，讓旅客能趁這段安靜空檔入睡。" },
    ],
    hint: "電話的用途，除了把話傳給另一個人，還有什麼？",
    sources: [
      {
        title: "Jed Hartman｜Situation puzzles，第 1.63 題（經典情節・獨立重述）",
        url: "https://www.kith.org/jed/situation-puzzles/answers-to-jeds-list-of-situation-puzzles/",
      },
    ],
  },
];
