# -*- coding: utf-8 -*-
"""Fill zh fields in scenic guide JSON files with tour-guide Chinese."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GUIDES = ROOT / "data" / "scenic_guides"

ZH: dict[str, dict[str, str]] = {
    "danxia": {
        "danxia-s01": "各位早上好。",
        "danxia-s02": "欢迎来到广东。",
        "danxia-s03": "今天我们游览丹霞山，它位于韶关市东北约四十五公里处——这里是世界著名的红石景观，也是一种地质术语的命名地。",
        "danxia-s04": "在岭南旅游口语里，它位列岭南四大名山之中：丹霞、罗浮、西樵和鼎湖。",
        "danxia-s05": "地质研究表明，两千五百万年前，这里还是一片广阔低洼的湖泊。",
        "danxia-s06": "后来地壳运动抬升了地面，湖水退去，湖底的沉积物逐渐氧化成红色岩石。",
        "danxia-s07": "你们今天看到的这些鲜红崖壁，就是这样形成的。",
        "danxia-s08": "二十世纪三十年代，中山大学的陈国达 Chen Guoda 教授对丹霞山以及华南其他红岩山体做了深入研究。",
        "danxia-s09": "他把这种红岩地貌命名为“丹霞地貌”。这个名称很快被全世界接受。",
        "danxia-s10": "从那以后，凡是见到由红色砂砾岩构成、崖壁陡峭鲜红的景观，地质学家都称之为丹霞地貌。",
        "danxia-s11": "除南极洲外，各大洲都能找到丹霞地貌——比如美国的大峡谷，以及德国萨克森的一些地区。",
        "danxia-s12": "但丹霞山本身，是同类中规模最大、最典型、也最美的一处。",
        "danxia-s13": "请大家环顾四周。",
        "danxia-s14": "这座山占地三百一十九平方公里，六百多座红岩峰峦挺立在绿林之间——像一座红宝石雕塑园。",
        "danxia-s15": "所以它又被称为中国红石公园，或中国红宝石公园 China Ruby Park。",
        "danxia-s16": "一九九五年，国务院批准它为地质自然保护区。",
        "danxia-s17": "接下来，我们走经典观景路线——从江到桥，从“阳”到“阴”，最后进入寺庙。",
        "danxia-s18": "请看锦江对岸的那些岩石。",
        "danxia-s19": "它们像一群大象正涉水向我们走来——象鼻、象牙、耳朵和眼睛都栩栩如生。",
        "danxia-s20": "所以这处景观叫作“群象过江” The Elephants Crossing the River。",
        "danxia-s21": "现在我们站在阳元桥上。",
        "danxia-s22": "请向右边看，远处那座山。",
        "danxia-s23": "它像一位少女躺着入睡：从右到左，头、颈、胸、腹轮廓清晰。",
        "danxia-s24": "这处景观叫“睡美人” The Sleeping Belle，也叫“玉女拦江” Yu Nü Lan Jiang。",
        "danxia-s25": "下一站是阳元山，意思是“男性之山”。这里著名的石柱——阳元石——高约二十八米，直径约七米，外形酷似男性生殖器。",
        "danxia-s26": "地质研究表明，它原是崖壁的一部分；历经约三十万年，大自然把它从山体分离，并雕成今天的样子。",
        "danxia-s27": "旧时重男轻女，人们祈求多子以续香火，所以香客常来朝拜这块石头。",
        "danxia-s28": "附近是阴元石景区，大约形成于十万年前。",
        "danxia-s29": "正如上帝在伊甸园里塑造了亚当和夏娃，大自然也在丹霞雕出了一对石质夫妻。",
        "danxia-s30": "这世界真奇妙啊！",
        "danxia-s31": "最后是别传寺，建于一六六二年，也就是康熙元年。",
        "danxia-s32": "清代这里香火鼎盛，位列粤北三大佛寺之一。",
        "danxia-s33": "在大雄宝殿里，请看一块形似龙的岩石。",
        "danxia-s34": "它叫“变色龙”——颜色随季节而变：春浅绿、夏深绿、秋黄绿、冬棕黄。",
        "danxia-s35": "所以丹霞既是地质课堂，又是一本画册：古湖变红、名字走向世界、江中群象、桥上睡美人、阴阳石夫妻，还有会变色的寺中龙。",
        "danxia-s36": "如果考官问起成因、命名，或这些景观中的任何一处，这条路线里你都已经有答案了。",
        "danxia-s37": "欢迎大家提问。",
    },
    "kaiping": {
        "kaiping-s01": "大家好。",
        "kaiping-s02": "今天我们探索江门的开平碉楼与村落——一座露天博物馆，华侨梦想与堡垒城墙在此相遇。",
        "kaiping-s03": "在岭南建筑版图上，这些碉楼作为世界文化遗产的堡垒式建筑而矗立，与西关大屋、骑楼、客家围屋，以及陈家祠这类礼制建筑并列。",
        "kaiping-s04": "开平碉楼是一种兼具防卫、居住和中西建筑艺术的塔楼式建筑。",
        "kaiping-s05": "它被誉为“华侨文化的典范之作”和“世界建筑艺术博物馆”，也是全国重点文物保护单位。",
        "kaiping-s06": "鼎盛时期有三千三百多座；今天登记在册的约一千八百三十三座；其中二十座精品列入联合国教科文组织世界遗产名录。",
        "kaiping-s07": "大家可能会问：归侨为什么要建这样的楼？",
        "kaiping-s08": "第一，当时治安不好，匪患是大麻烦，较富裕的归侨家庭往往成为抢劫目标。",
        "kaiping-s09": "第二，开平地势低洼，洪水频发。",
        "kaiping-s10": "所以这些坚固的高层建筑，既能防匪，又能避洪。",
        "kaiping-s11": "按功能分，大致有三种：",
        "kaiping-s12": "众楼——由几户人家合建，供临时避难；二、",
        "kaiping-s13": "居楼——富裕人家自建的堡垒式住宅；三、",
        "kaiping-s14": "更楼——主要用于防匪警戒。",
        "kaiping-s15": "记住三个词：众楼、居楼、更楼——communal, residential, watch。",
        "kaiping-s16": "在自力村，铭石楼 Mingshilou 是精品中的精品。",
        "kaiping-s17": "建于一九二五年，是一座五层钢筋混凝土居楼。",
        "kaiping-s18": "楼顶有一座中西合璧的六角观景亭；五楼四角各有一个碉堡，又称“燕子窝”。整座楼体量宏大、气势雄伟，铁门铁窗厚重坚固，装饰豪华，生活设施齐全。",
        "kaiping-s19": "瑞石楼 Ruishilou 是开平最高、最豪华的碉楼：九层，高约二十五米，钢筋混凝土结构，内部为中国传统雅致装修——被评为开平第一楼。",
        "kaiping-s20": "方氏灯楼 Fangshi Denglou 由方氏家族建于一九二〇年，是最典型的更楼：地势开阔、视野宽广，防卫设备齐全——发电机、探照灯和枪支。",
        "kaiping-s21": "现在我们来到立园 Li Garden，位于塘口镇北义村。",
        "kaiping-s22": "建于一九三六年，是一座中西合璧的别墅园林。",
        "kaiping-s23": "高大的拱门上写着“立园”二字。",
        "kaiping-s24": "美籍华人园主谢维立取自自己的名字，也寄托着园中牌坊所写的“修身立本”——培养品德是成功的根本。",
        "kaiping-s25": "同一理念也出现在许多题字和对联中。",
        "kaiping-s26": "园林分三个区域：别墅区、大花园区和小花园区。",
        "kaiping-s27": "主要景点包括“立园”拱门、“修身立本”牌坊、四座桥亭，以及两座罗马式建筑——“鸟巢”和“藤亭”。",
        "kaiping-s28": "别墅区的住宅建筑中西合璧：主体多为洋式结构，有的屋顶却像中国宫殿；室内有西式壁炉与吊灯、意大利瓷砖，也有中式木家具（含红木风格）、民间故事壁画和鎏金木雕。",
        "kaiping-s29": "开平把安全、财富与文化交融，浓缩在同一片天际线上。",
        "kaiping-s30": "记住三组数字——三千三百、一千八百三十三、二十；三座楼名——铭石、瑞石、方氏；还有一句园中话——修身立本 Xiu Shen Li Ben——景点问答和口译段落你都能应对。",
        "kaiping-s31": "欢迎提问。",
    },
    "sun-yat-sen-hall": {
        "sun-yat-sen-hall-s01": "各位早上好。",
        "sun-yat-sen-hall-s02": "欢迎来到广州中山纪念堂——中国民主革命的地标，也是中国近代建筑的杰作。",
        "sun-yat-sen-hall-s03": "孙中山是中国资产阶级民主革命的先行者。",
        "sun-yat-sen-hall-s04": "他把一生献给了这项事业；他所领导的辛亥革命，结束了延续数千年的封建帝制。",
        "sun-yat-sen-hall-s05": "为纪念他的贡献，广州人民于一九二九至一九三一年，在原南方革命政府总统府旧址上建造了这座纪念堂。",
        "sun-yat-sen-hall-s06": "工程于一九三一年十月竣工。",
        "sun-yat-sen-hall-s07": "童年与立志。",
        "sun-yat-sen-hall-s08": "他生于一八六六年十一月十二日，广东香山县翠亨村的一个农民家庭——也就是今天的中山市。",
        "sun-yat-sen-hall-s09": "十二岁时前往檀香山，兄长送他进教会学校读书。",
        "sun-yat-sen-hall-s10": "后来他在香港学习西医，并在广州和澳门行医。",
        "sun-yat-sen-hall-s11": "自幼受到西方基督教与民主思想影响，他立志医治旧中国的弊病，把它变成一个民主、强盛的国家。",
        "sun-yat-sen-hall-s12": "从改良到革命。",
        "sun-yat-sen-hall-s13": "起初他对清政府仍抱幻想，希望通过改良挽救这个垂死的政权。",
        "sun-yat-sen-hall-s14": "但中国在外敌面前接连失败，加上清廷腐败无能，使他的爱国义愤日益强烈。",
        "sun-yat-sen-hall-s15": "他断定清朝已烂到根子上，必须推翻，代之以民主共和国。",
        "sun-yat-sen-hall-s16": "组织斗争。",
        "sun-yat-sen-hall-s17": "一八九四年，他在檀香山创立了中国第一个资产阶级革命团体——兴中会 Xing Zhong Hui。",
        "sun-yat-sen-hall-s18": "次年春天他回国，在广州发动第一次反清武装起义，但失败了。",
        "sun-yat-sen-hall-s19": "一九〇五年在日本，他创立了中国第一个政党——中国同盟会 Tong Meng Hui，后来发展为国民党 Guomintang。",
        "sun-yat-sen-hall-s20": "经过多次尝试，一九一一年十月武昌起义终于成功。",
        "sun-yat-sen-hall-s21": "清朝覆灭，他当选为中华民国临时政府临时大总统。",
        "sun-yat-sen-hall-s22": "纪念堂是一座八角形、宫殿式钢筋混凝土建筑，高五十八米，建筑面积约一万二千平方米。",
        "sun-yat-sen-hall-s23": "外观像传统中国宫殿，却采用了当时最新的建造技术。",
        "sun-yat-sen-hall-s24": "设计者是年轻的中国建筑师吕彦直 Lu Yanzhi：生于天津，毕业于北京清华大学，后赴美国康奈尔大学学习建筑。",
        "sun-yat-sen-hall-s25": "一九二九年他因肺癌去世，年仅三十六岁，未能看到纪念堂落成。",
        "sun-yat-sen-hall-s26": "请走进大堂。",
        "sun-yat-sen-hall-s27": "这里可容纳三千二百三十八人。",
        "sun-yat-sen-hall-s28": "几乎从任何一个座位望去，都看不到遮挡视线的支撑柱。",
        "sun-yat-sen-hall-s29": "巨大的穹顶由四榀大跨度钢桁架托起；支撑它们的八根柱子藏在墙体之中。",
        "sun-yat-sen-hall-s30": "声学效果极佳——没有恼人的回声——所以每次演讲和演出都清晰可闻。",
        "sun-yat-sen-hall-s31": "记住三个层次：人（翠亨 → 兴中会 → 同盟会 → 一九一一年）、壳（八角、五十八米、吕彦直）、堂（三千二百三十八席、隐柱、完美音效）。",
        "sun-yat-sen-hall-s32": "这样，这个景点的问答和口译段落就都覆盖到了。",
        "sun-yat-sen-hall-s33": "欢迎大家提问。",
    },
    "nanyue-king-museum": {
        "nanyue-king-museum-s01": "大家好。",
        "nanyue-king-museum-s02": "欢迎来到南越王博物馆的王墓展区。",
        "nanyue-king-museum-s03": "象岗山下两千年的岁月，仍通过玉、青铜和黄金在诉说。",
        "nanyue-king-museum-s04": "在认识墓主之前，先快速回顾一段历史：先秦时期这一带是南越人的家园；秦统一岭南后，在此设南海郡——今天的广州，就从这座郡治发展而来。",
        "nanyue-king-museum-s05": "西汉初年，原秦将赵佗 Zhao Tuo 建立南越国，推行汉越融合。",
        "nanyue-king-museum-s06": "南越国历经五位国王、共九十三年，直到公元前一一一年归附汉朝。",
        "nanyue-king-museum-s07": "墓主是赵眜 Zhao Mo。",
        "nanyue-king-museum-s08": "他自称“文帝”，是南越国第二代国王。",
        "nanyue-king-museum-s09": "他在汉武帝建元四年即位，在位十六年，从公元前一三七到一二二年。",
        "nanyue-king-museum-s10": "赵眜墓于一九八三年发现，位于广州解放北路象岗山下二十米处。",
        "nanyue-king-museum-s11": "墓室约一百平方米，用七百五十块红砂岩石砌成，分前后两部分，共七个墓室。",
        "nanyue-king-museum-s12": "这是迄今华南发现的最重要的汉代墓葬——规模最大、墓主人政治社会地位最高、出土文物也最丰富。",
        "nanyue-king-museum-s13": "它被认为是中国现代五大考古发现之一。",
        "nanyue-king-museum-s14": "考古人员还在原广州市儿童公园遗址试掘了约五百平方米的南越宫署遗址（中文材料注明在东侧）。",
        "nanyue-king-museum-s15": "发掘位置与汉长安宫中的长乐宫位置相对应——那么这里会是南越的“长乐宫”吗？",
        "nanyue-king-museum-s16": "还需要进一步研究。",
        "nanyue-king-museum-s17": "墓中发现十五人为殉葬：前室一人——“景巷令”，或许是宦官；外棺一人，可能是车夫。",
        "nanyue-king-museum-s18": "活人殉葬在商周时期（公元前一七六六至七七〇年）曾盛行于中原，到汉代（公元前二〇六至公元二二〇年）已基本废除。",
        "nanyue-king-museum-s19": "这里发现这么多殉人，说明南越统治阶级仍在实行这一残酷习俗。",
        "nanyue-king-museum-s20": "请把两枚印章的故事分清楚——它们是不同的器物。",
        "nanyue-king-museum-s21": "第一枚是文帝金印：迄今考古出土的唯一一枚秦汉时期皇帝印玺。",
        "nanyue-king-museum-s22": "文献记载帝印应为白玉虎钮；但赵眜这枚是龙钮金印，在南越铸造，生前使用。",
        "nanyue-king-museum-s23": "第二是玉印。",
        "nanyue-king-museum-s24": "墓中出土九枚印章，其中三枚发现于主棺室赵眜身上，分别刻有“赵眜”、“太子”和“帝印”。",
        "nanyue-king-museum-s25": "它们共同证明赵眜僭越称帝，脱离汉朝而行使地方权力。",
        "nanyue-king-museum-s26": "玉衣是汉代特有的葬制。",
        "nanyue-king-museum-s27": "别处通常用金缕、银缕或铜缕编缀。",
        "nanyue-king-museum-s28": "赵眜的玉衣用丝缕编缀——这是中国迄今发现的第一件、也是唯一一件丝缕玉衣。",
        "nanyue-king-museum-s29": "这件玉衣长一点七三米，由两千二百九十一片玉片用红色丝缕串成，图案鲜明美丽。",
        "nanyue-king-museum-s30": "五十六件玉璧中，四十七件出自主棺室；其中一件直径三十三点四厘米——是中国出土同类中最大的。",
        "nanyue-king-museum-s31": "兵器中有一件铜戈，铭文为“王四年相邦张义”。它在秦惠王时期由张义监造，后带到南方。",
        "nanyue-king-museum-s32": "一件错金铜虎节，是中国现存唯一的错金虎节——用于调兵或外交的凭证。",
        "nanyue-king-museum-s33": "尤其值得一提的是一组青铜乐器“句鑃”Gou Diao：共八件，铸有铭文“文帝九年乐府工造”，说明它们于公元前一二九年在南越制成。",
        "nanyue-king-museum-s34": "历经两千一百多年，它们仍能发出清晰、准确的音高。",
        "nanyue-king-museum-s35": "有一件银盒，从造型和纹饰看与中国传统银器截然不同；对盒内丸药的化学分析显示，它很可能来自海外波斯，内容物似为一种阿拉伯药物——这是早期海上交往的证据。",
        "nanyue-king-museum-s36": "许多青铜器和其他文物工艺精湛，并带有鲜明的地方特色。",
        "nanyue-king-museum-s37": "它们反映了南越的金属铸造技艺，也是广州建城史的重要证据。",
        "nanyue-king-museum-s38": "请记住这条链条：赵佗建国 → 第二代王赵眜 → 一九八三年象岗 → 十五人殉葬 → 龙钮金印加九枚玉印（三枚在身上） → 丝缕玉衣 → 青铜珍宝 → 广州起源。",
        "nanyue-king-museum-s39": "这就是本展区白皮书的完整工具包。",
        "nanyue-king-museum-s40": "欢迎提问。",
    },
    "chen-family-temple": {
        "chen-family-temple-s01": "欢迎各位。",
        "chen-family-temple-s02": "今天我们参观陈家祠，也称陈氏书院——广州城中心的“岭南建筑艺术明珠”。",
        "chen-family-temple-s03": "在岭南建筑大家族里，它与南海神庙、佛山祖庙等并列，属于重要的礼制建筑；而开平碉楼则代表世界遗产级的民间堡垒建筑。",
        "chen-family-temple-s04": "这里既是陈姓各房祭祀共同祖先的祠堂，也是节庆等特殊场合举行宗族活动的场所，还是陈氏子弟读书的学堂——所以叫“陈氏书院”。",
        "chen-family-temple-s05": "装饰上，它汇集了广东民间工艺的精华。",
        "chen-family-temple-s06": "从屋顶到地面，里里外外——柱、檐、脊、阶、门窗——都能见到石雕、砖雕、灰塑、陶塑、木雕和铸铁艺术品。",
        "chen-family-temple-s07": "图案都有寓意：牡丹象征富贵，并蒂莲象征恩爱夫妻，狮子象征威严与权势。",
        "chen-family-temple-s08": "因此它被称为岭南建筑艺术明珠。",
        "chen-family-temple-s09": "一九五九年，这里成为广东民间工艺博物馆（英文材料中也称广州民间工艺博物馆）。",
        "chen-family-temple-s10": "请在正门停一下。",
        "chen-family-temple-s11": "两侧的石鼓象征社会地位。",
        "chen-family-temple-s12": "在清代封建社会，只有家族中有人考取进士或更高功名，才能在门前摆放石鼓。",
        "chen-family-temple-s13": "这里有个具体故事：一八九三年——祠堂建成前一年——族人陈伯陶 Chen Botao 考中探花（殿试第三名），这些石鼓就是为他而立的。",
        "chen-family-temple-s14": "请再看石鼓右侧后方的浮雕，叫“爵禄封侯” Jue Lu Feng Hou。",
        "chen-family-temple-s15": "雀、鹿、蜂、猴出现在一起：它们的中文名称与爵位、俸禄、封侯谐音——寄托陈氏子孙金榜题名、官运亨通的愿望。",
        "chen-family-temple-s16": "大门两侧墙上的砖雕，刻画了中国历史小说中的不同故事——是广东砖雕的代表作。",
        "chen-family-temple-s17": "门扇上画着门神。",
        "chen-family-temple-s18": "最早的门神是传说中的神荼和郁垒，据说能捉鬼护宅。",
        "chen-family-temple-s19": "他们身着华丽铠甲，手持绳索，威风凛凛。",
        "chen-family-temple-s20": "请注意一个倒着的“福”字，常出现在木雕背面。",
        "chen-family-temple-s21": "中文里“倒”与“到”谐音，所以倒福意味着“福到了”——幸福已经到来。",
        "chen-family-temple-s22": "栏杆顶端雕着南方水果：桃、杨桃、木瓜、荔枝等——象征把最精美的岭南佳果献给陈氏祖先。",
        "chen-family-temple-s23": "请看这幅图：母鸡带着小鸡在芭蕉树下觅食。",
        "chen-family-temple-s24": "鸡群代表今人；芭蕉的“大叶”与“大业”谐音，暗示先辈开创的财富与事业。",
        "chen-family-temple-s25": "另一幅图暗示：年轻人或许学得快，但大学问需要经年累月才能成就——就像英语谚语“罗马不是一日建成的”。它鼓励人们持之以恒地学习。",
        "chen-family-temple-s26": "在宗族书院里，这个道理再贴切不过：成才需要时间。",
        "chen-family-temple-s27": "最后是后堂，陈氏族人在此祭祀祖先。",
        "chen-family-temple-s28": "神龛上的牌位按辈分排列；最高处是舜帝，被认为是陈氏远祖，后世列于其下。",
        "chen-family-temple-s29": "一颗明珠，三重功能；门前——探花陈伯陶的石鼓、雀鹿蜂猴祈爵禄、砖雕故事与门神；祠内——六大工艺与牡丹莲狮寓意、倒福、岭南佳果、芭蕉“大业”、劝学需年岁的画，以及后堂的舜帝。",
        "chen-family-temple-s30": "这就是白皮书中陈家祠的完整工具包。",
        "chen-family-temple-s31": "非常感谢。",
        "chen-family-temple-s32": "欢迎提问。",
    },
}


def main() -> None:
    counts: dict[str, int] = {}
    empty: list[str] = []

    for spot_id, translations in ZH.items():
        path = GUIDES / f"{spot_id}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        for sent in data["sentences"]:
            sid = sent["id"]
            if sid not in translations:
                empty.append(f"missing translation: {sid}")
                continue
            sent["zh"] = translations[sid]
            if not sent["zh"].strip():
                empty.append(f"empty zh: {sid}")
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        counts[spot_id] = len(data["sentences"])

    # Verify index.json sentence counts
    index_path = GUIDES / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    for spot in index["spots"]:
        expected = counts.get(spot["id"])
        if expected is not None and spot.get("sentenceCount") != expected:
            spot["sentenceCount"] = expected
    index_path.write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # Final verification
    print("=== Sentence counts ===")
    all_ok = True
    for spot_id in ZH:
        path = GUIDES / f"{spot_id}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        n = len(data["sentences"])
        blank = [s["id"] for s in data["sentences"] if not (s.get("zh") or "").strip()]
        status = "OK" if not blank else f"EMPTY: {blank}"
        if blank:
            all_ok = False
        print(f"{spot_id}: {n} sentences — all zh non-empty: {not blank} ({status})")

    if empty:
        all_ok = False
        print("Issues:", empty)
    print("ALL_ZH_NONEMPTY:" if all_ok else "HAS_EMPTY:", all_ok)
    print("TOTAL:", sum(counts.values()))


if __name__ == "__main__":
    main()
