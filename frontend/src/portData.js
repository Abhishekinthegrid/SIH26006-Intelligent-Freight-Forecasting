export const PORT_COORDS = {
  Balikpapan:[-1.27,116.83], Samarinda:[-0.50,117.15], 'Tanjung Perak':[-7.20,112.73], 'Tanjung Priok':[-6.10,106.88],
  Paradip:[20.27,86.69], Dhamra:[20.78,86.93], Chennai:[13.08,80.28], Visakhapatnam:[17.69,83.29], Kolkata:[22.56,88.34], Mundra:[22.74,69.70], Kandla:[23.03,70.22],
  'Port Hedland':[-20.31,118.58], 'Hay Point':[-21.27,149.30], Newcastle:[-32.93,151.78], Gladstone:[-23.84,151.26],
  Shanghai:[31.23,121.50], Guangzhou:[23.11,113.37], Qingdao:[36.07,120.38], 'Hai Phong':[20.84,106.69], 'Ho Chi Minh City':[10.77,106.70],
  Singapore:[1.29,103.85], 'Jebel Ali':[24.99,55.06], Khalifa:[24.80,54.68], Dammam:[26.44,50.10], Jeddah:[21.48,39.18],
  Durban:[-29.87,31.03], 'Richards Bay':[-28.80,32.04], 'Long Beach':[33.75,-118.21], Houston:[29.73,-95.02], 'New Orleans':[29.95,-90.06], 'Veracruz':[19.20,-96.14], Manzanillo:[19.05,-104.32],
  'Buenos Aires':[-34.60,-58.37], Rosario:[-32.95,-60.64], Santos:[-23.95,-46.30], 'Rio de Janeiro':[-22.90,-43.17],
  Rotterdam:[51.95,4.14], Casablanca:[33.60,-7.62], 'Jorf Lasfar':[33.12,-8.63], Damietta:[31.44,31.81],
  Kobe:[34.68,135.20], Yokohama:[35.45,139.65], 'Laem Chabang':[13.08,100.88], Mersin:[36.77,34.63], Iskenderun:[36.59,36.17], 'Tanjung Pelepas':[1.36,103.55], 'Port Klang':[3.00,101.39]
}
export const PORT_COUNTRY = {'Balikpapan':'Indonesia','Samarinda':'Indonesia','Tanjung Perak':'Indonesia','Tanjung Priok':'Indonesia','Paradip':'India','Dhamra':'India','Chennai':'India','Visakhapatnam':'India','Kolkata':'India','Mundra':'India','Kandla':'India','Port Hedland':'Australia','Hay Point':'Australia','Newcastle':'Australia','Gladstone':'Australia','Shanghai':'China','Guangzhou':'China','Qingdao':'China','Hai Phong':'Vietnam','Ho Chi Minh City':'Vietnam','Singapore':'Singapore','Jebel Ali':'UAE','Khalifa':'UAE','Dammam':'Saudi Arabia','Jeddah':'Saudi Arabia','Durban':'South Africa','Richards Bay':'South Africa','Long Beach':'USA','Houston':'USA','New Orleans':'USA','Veracruz':'Mexico','Manzanillo':'Mexico','Buenos Aires':'Argentina','Rosario':'Argentina','Santos':'Brazil','Rio de Janeiro':'Brazil','Rotterdam':'Netherlands','Casablanca':'Morocco','Jorf Lasfar':'Morocco','Damietta':'Egypt','Kobe':'Japan','Yokohama':'Japan','Laem Chabang':'Thailand','Mersin':'Turkey','Iskenderun':'Turkey','Tanjung Pelepas':'Malaysia','Port Klang':'Malaysia'}
export const PORTS_BY_COUNTRY = Object.entries(PORT_COUNTRY).reduce((a,[p,c])=>{(a[c] ||= []).push(p); return a},{})
