
const testText1 = 'Access to this information is provided as part of the WorldWideWeb project. The WWW' + "\n" +
  'project does not take responsability for the accuracy of information provided by others' + "\n" +
  'References to other information are represented like this. Double-click on it to jump to' + "\n" +
  'related information.' + "\n" +
  'Now choose an area in which you would like to start browsing. The system currently has' + "\n" +
  'access to three sources of information. With the indexes, you should use the keyword' + "\n" +
  'f to check actualBoundingBoxLeft doesn\'t cause f to be drawn outside the canvas.';

// note that the special charachter ’ below is NOT the single quote character '

const kernKingPart1 = 'lynx tuft frogs, dolphins abduct by proxy the ever awkward klutz, dud,' + "\n" +
  'dummkopf, jinx snubnose filmgoer, orphan sgt. renfruw grudgek reyfus, md. sikh psych if halt' + "\n" +
  'tympany jewelry sri heh! twyer vs jojo pneu fylfot alcaaba son of nonplussed halfbreed bubbly' + "\n" +
  'playboy guggenheim daddy coccyx sgraffito effect, vacuum dirndle impossible attempt to' + "\n" +
  'disvalue, muzzle the afghan czech czar and exninja, bob bixby dvorak wood dhurrie savvy, dizzy' + "\n" +
  'eye aeon circumcision uvula scrungy picnic luxurious special type carbohydrate ovoid adzuki' + "\n" +
  'kumquat bomb? afterglows gold girl pygmy gnome lb. ankhs acme aggroupment akmed brouhha tv wt.' + "\n" +
  'ujjain ms. oz abacus mnemonics bhikku khaki bwana aorta embolism vivid owls often kvetch' + "\n" +
  'otherwise, wysiwyg densfort wright you’ve absorbed rhythm, put obstacle kyaks krieg kern' + "\n" +
  'wurst subject enmity equity coquet quorum pique tzetse hepzibah sulfhydryl briefcase ajax ehler' + "\n" +
  'kafka fjord elfship halfdressed jugful eggcup hummingbirds swingdevil bagpipe legwork' + "\n" +
  'reproachful hunchback archknave baghdad wejh rijswijk rajbansi rajput ajdir okay weekday' + "\n" +
  'obfuscate subpoena liebknecht marcgravia ecbolic arcticward dickcissel pincpinc boldface' + "\n" +
  'maidkin adjective adcraft adman dwarfness applejack darkbrown kiln palzy always farmland' + "\n" +
  'flimflam unbossy nonlineal stepbrother lapdog stopgap sx countdown basketball beaujolais vb.' + "\n" +
  'flowchart aztec lazy bozo syrup tarzan annoying dyke yucky hawg gagzhukz cuzco squire when hiho' + "\n" +
  'mayhem nietzsche szasz gumdrop milk emplotment ambidextrously lacquer byway ecclesiastes' + "\n" +
  'stubchen hobgoblins crabmill aqua hawaii blvd. subquality byzantine empire debt obvious' + "\n" +
  'cervantes jekabzeel anecdote flicflac mechanicville bedbug couldn’t i’ve it’s they’ll they’d' + "\n" +
  'dpt. headquarter burkhardt xerxes atkins govt. ebenezer lg. lhama amtrak amway fixity axmen' + "\n" +
  'quumbabda upjohn hrumpf'

const kernKingPart2 = 'Aaron Abraham Adam Aeneas Agfa Ahoy Aileen Akbar Alanon Americanism' + "\n" +
  'Anglican Aorta April Fool’s Day Aqua Lung (Tm.) Arabic Ash Wednesday Authorized Version Ave' + "\n" +
  'Maria Away Axel Ay Aztec Bhutan Bill Bjorn Bk Btu. Bvart Bzonga California Cb Cd Cervantes' + "\n" +
  'Chicago Clute City, Tx. Cmdr. Cnossus Coco Cracker State, Georgia Cs Ct. Cwacker Cyrano David' + "\n" +
  'Debra Dharma Diane Djakarta Dm Dnepr Doris Dudley Dwayne Dylan Dzerzhinsk Eames Ectomorph Eden' + "\n" +
  'Eerie Effingham, Il. Egypt Eiffel Tower Eject Ekland Elmore Entreaty Eolian Epstein Equine' + "\n" +
  'Erasmus Eskimo Ethiopia Europe Eva Ewan Exodus Jan van Eyck Ezra Fabian February Fhara Fifi' + "\n" +
  'Fjord Florida Fm France Fs Ft. Fury Fyn Gabriel Gc Gdynia Gehrig Ghana Gilligan Karl Gjellerup' + "\n" +
  'Gk. Glen Gm Gnosis Gp.E. Gregory Gs Gt. Br. Guinevere Gwathmey Gypsy Gzags Hebrew Hf Hg Hileah' + "\n" +
  'Horace Hrdlicka Hsia Hts. Hubert Hwang Hai Hyacinth Hz. Iaccoca Ibsen Iceland Idaho If Iggy' + "\n" +
  'Ihre Ijit Ike Iliad Immediate Innocent Ione Ipswitch Iquarus Ireland Island It Iud Ivert' + "\n" +
  'Iwerks Ixnay Iy Jasper Jenks Jherry Jill Jm Jn Jorge Jr. Julie Kerry Kharma Kiki Klear Koko' + "\n" +
  'Kruse Kusack Kylie Laboe Lb. Leslie Lhihane Llama Lorrie Lt. Lucy Lyle Madeira Mechanic Mg.' + "\n" +
  'Minnie Morrie Mr. Ms. Mt. Music My Nanny Nellie Nillie Novocane Null Nyack Oak Oblique' + "\n" +
  'Occarina Odd Oedipus Off Ogmane Ohio Oil Oj Oklahoma Olio Omni Only Oops Opera Oqu Order Ostra' + "\n" +
  'Ottmar Out Ovum Ow Ox Oyster Oz Parade Pd. Pepe Pfister Pg. Phil Pippi Pj Please Pneumonia' + "\n" +
  'Porridge Price Psalm Pt. Purple Pv Pw Pyre Qt. Quincy Radio Rd. Red Rhea Right Rj Roche Rr Rs' + "\n" +
  'Rt. Rural Rwanda Ryder Sacrifice Series Sgraffito Shirt Sister Skeet Slow Smore Snoop Soon' + "\n" +
  'Special Squire Sr St. Suzy Svelte Swiss Sy Szach Td Teach There Title Total Trust Tsena Tulip' + "\n" +
  'Twice Tyler Tzean Ua Udder Ue Uf Ugh Uh Ui Uk Ul Um Unkempt Uo Up Uq Ursula Use Utmost Uvula' + "\n" +
  'Uw Uxurious Uzßai Valerie Velour Vh Vicky Volvo Vs Water Were Where With World Wt. Wulk Wyler' + "\n" +
  'Xavier Xerox Xi Xylophone Yaboe Year Yipes Yo Ypsilant Ys Yu Zabar’s Zero Zhane Zizi Zorro Zu' + "\n" +
  'Zy Don’t I’ll I’m I’se'