export const VESSELS = [
  ['Handysize',10000,39999,170,28,9.5,5,'Short-haul dry bulk, flexible smaller parcels','/vessels/handysize.svg','Coastal bulk, minor bulks, grain and smaller coal parcels'],
  ['Handymax',40000,59999,190,32,11,5,'Regional dry bulk and multi-cargo trades','/vessels/handymax.svg','Regional dry bulk, grain, coal and multipurpose trades'],
  ['Supramax',50000,59999,200,32,12,5,'Versatile geared bulk carrier for coal and grain','/vessels/supramax.svg','Coal, grain, mineral products and flexible bulk trades'],
  ['Ultramax',60000,69999,200,33,12.5,5,'Higher payload with flexible port access','/vessels/ultramax.svg','Coal, grain, ore and higher-volume dry bulk trades'],
  ['Panamax',70000,85000,230,32,13.5,6,'Mainstream bulk carrier for coal, grain and ore','/vessels/panamax.svg','Coal, iron ore, grain and large dry-bulk trades'],
  ['Kamsarmax',80000,89999,229,32,14,7,'Larger Panamax-class ship optimized for bulk trades','/vessels/kamsarmax.svg','Large coal and grain parcels with Panamax-compatible port access'],
  ['Post-Panamax',90000,119999,245,36,15,7,'Large bulk carrier for high-volume cargo','/vessels/postpanamax.svg','High-volume coal and grain trades requiring deeper terminals'],
  ['Capesize',120000,199999,290,45,17,8,'Very large dry bulk for iron ore and coal','/vessels/capesize.svg','Iron ore and coal on deepwater long-haul routes'],
  ['Newcastlemax',200000,299999,300,47,18,9,'Very large bulk trade with deepwater requirements','/vessels/newcastlemax.svg','Very large coal and ore trades between deepwater terminals'],
  ['VLOC',300000,400000,330,60,21,9,'Ultra-large ore carrier for major terminals','/vessels/vloc.svg','Ultra-large iron ore trades between major deepwater terminals']
].map(v=>({name:v[0],min:v[1],max:v[2],loa:v[3],beam:v[4],draft:v[5],holds:v[6],description:v[7],image:v[8],usage:v[9]}))
