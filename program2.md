# Mülk Takip Uygulaması Araştırması (100–200 Bağımsız Bölüm İçin)

Hazırlanma tarihi: 21 Nisan 2026

## Amaç

100–200 adet daire/işyeri bulunan bir portföyü yönetebilen; mülk takibi, kira takibi, vergi/muhasebe, bakım–arıza ve raporlama süreçlerini tek merkezden yürütebilecek uygulamaların incelenmesi ve böyle bir yazılım için gerekli modüllerin çıkarılması.

---

## 1) Web araştırmasından çıkan genel sonuç

Piyasadaki güçlü mülk yönetim yazılımlarında ortak olarak öne çıkan başlıklar şunlardır:

- **Kira tahsilatı ve gecikme yönetimi**
- **Sözleşme / lease yönetimi**
- **Bakım–arıza talebi ve iş emri yönetimi**
- **Muhasebe, gelir-gider, banka entegrasyonu ve finansal raporlama**
- **Kiracı / malik / yönetici portalları**
- **Çoklu mülk ve çoklu birim yönetimi**
- **Mobil erişim ve bildirim altyapısı**
- **Denetim / inspection / saha kontrol süreçleri**
- **Vergi dönemine hazır finansal raporlar**

Bu yapı özellikle 50+ birimden sonra kritik hale geliyor; 100–200 birim bandında ise Excel ile sürdürülebilirlik ciddi şekilde düşüyor.

---

## 2) İncelenen uygulama tipleri

### A) Site / apartman / yaşam alanı odaklı çözümler
Bu tarafta Türkiye’de **Apsiyon** dikkat çekiyor. Platform; apartman, site, iş merkezi, bina ve rezidans yönetimini hedefliyor ve özellikle şu alanları öne çıkarıyor:

- Aidat takip
- Online banka entegrasyonları
- Kart ile online tahsilat
- Sayaç okuma ve faturalandırma
- Yönetici mobil uygulaması
- E-posta / SMS gönderimi
- AVM yönetimi ve ek yaşam alanı modülleri

**Değerlendirme:**  
Eğer senaryoda ortak alan yönetimi, aidat, sayaç, yönetim–sakin iletişimi ve tesis/rezidans mantığı baskınsa güçlü bir referans modeldir. Ancak klasik ticari kira yönetimi, lease abstraction, kira artış senaryoları, sahibi-kiracısı farklı ticari portföy yönetimi gibi alanlarda ayrıca doğrulama gerekebilir.

### B) Kira ve portföy yönetimi odaklı uluslararası çözümler
Bu segmentte öne çıkan yapılar:

#### Buildium
Öne çıkan yetenekler:
- Residential + commercial portföy desteği
- Leasing
- Rent collection
- Maintenance
- Property accounting
- Resident / owner iletişimi
- Lease, rent escalations ve CAM charge takibi

**Değerlendirme:**  
Karma portföy (konut + ticari) için dengeli bir yapı sunuyor. 100–200 bağımsız bölüm için uygun ölçek bandında düşünülebilir.

#### DoorLoop
Öne çıkan yetenekler:
- Tek platformda accounting + rent collection + maintenance + tenant screening
- Owner portal
- Trust accounting
- Gerçek zamanlı raporlama
- Otomatik kira tahsilatı, hatırlatma ve gecikme cezası

**Değerlendirme:**  
Özellikle operasyon + finansı tek panelde toplamak isteyen ekipler için güçlü bir referans.

#### AppFolio
Öne çıkan yetenekler:
- Maintenance workflows
- Mobile inspections
- Unit turn board
- Tenant / owner portal
- Finansal görünürlük ve otomasyon
- Orta ve büyük portföylerde ölçeklenebilir kullanım

**Değerlendirme:**  
Saha operasyonu, bakım organizasyonu ve denetim süreçleri güçlü olsun isteniyorsa referans alınabilecek iyi bir örnek.

#### TenantCloud
Öne çıkan yetenekler:
- Online rent collection
- Maintenance request tracking
- Lease management
- Financial reporting
- Communication tools
- Tax-ready reports / depreciation / amortization raporları

**Değerlendirme:**  
Daha erişilebilir, bulut tabanlı ve modüler yaklaşım isteyenler için önemli bir örnek. Özellikle raporlama ve kira süreçleri açısından faydalı.

---

## 3) 100–200 daire/işyeri olan müşteri için ihtiyaç yorumu

Bu büyüklükte bir müşteri için uygulama yalnızca “kira tahsilatı ekranı” olmamalı. En azından aşağıdaki 4 katmanı aynı anda çözmeli:

1. **Portföy ve envanter yönetimi**
2. **Kira / tahsilat / sözleşme yönetimi**
3. **Muhasebe / vergi / raporlama**
4. **Bakım / arıza / operasyon yönetimi**

Eğer portföyde hem **konut** hem **işyeri** varsa, sistemin şu detayları da desteklemesi gerekir:

- Farklı kira dönemleri
- Farklı stopaj / KDV / vergi senaryoları
- Depozito takibi
- Aidat ve ortak gider yönetimi
- Sayaç / fatura / hizmet bedeli takibi
- Sözleşme yenileme ve kira artış geçmişi
- Malik bazlı raporlama
- Bir mülk içinde birden fazla bağımsız bölüm ve farklı kiracı geçmişi

---

## 4) Gerekli modüller

Aşağıdaki modüller, böyle bir yazılım için çekirdek ihtiyaç setidir.

### 4.1 Portföy / Mülk Yönetimi Modülü
**Amaç:** Tüm mülklerin hiyerarşik takibi.

İçerik:
- Portföy kartı
- Bina / site / iş merkezi kartı
- Bağımsız bölüm kartı
- Tür bilgisi: daire, dükkan, ofis, depo, otopark vb.
- m², ada/parsel, adres, tapu, kullanım tipi
- Durum: boş, dolu, bakımda, rezervli, satışta, pasif

### 4.2 Malik / Hissedar Yönetimi
**Amaç:** Mülk sahiplerinin ve hisse oranlarının takibi.

İçerik:
- Malik kartı
- Hisse oranı
- Banka bilgileri
- Vergi / TCKN / VKN bilgileri
- Malik bazlı gelir raporu
- Çok malik / çok paylı mülk desteği

### 4.3 Kiracı Yönetimi
**Amaç:** Kiracı yaşam döngüsünü izlemek.

İçerik:
- Kiracı kartı
- İletişim bilgileri
- Kiracı geçmişi
- Kefil / ek kişi bilgileri
- Evrak ve sözleşme bağlantıları
- Borç / alacak özeti

### 4.4 Sözleşme Yönetimi
**Amaç:** Kira sözleşmelerinin dijital yönetimi.

İçerik:
- Başlangıç / bitiş tarihi
- Kira periyodu
- Kira artış kuralı
- Depozito
- Para birimi
- Yenileme ve fesih takibi
- Otomatik hatırlatma
- Dosya ekleri ve versiyonlama

### 4.5 Kira Takip ve Tahsilat Modülü
**Amaç:** Tahakkuk, tahsilat ve gecikme yönetimi.

İçerik:
- Aylık kira tahakkuku
- Tahsilat girişi
- Kısmi ödeme
- Gecikme faizi / cezası
- Otomatik ödeme hatırlatması
- Makbuz / dekont eşleme
- Banka hareketleri ile eşleştirme
- Açık borç listesi

### 4.6 Aidat / Ortak Gider Yönetimi
**Amaç:** Site ve çoklu bina yapısında ortak giderlerin takibi.

İçerik:
- Aidat tanımı
- Ortak gider kalemleri
- Bağımsız bölümlere dağıtım
- Aidat tahakkuku
- Tahsilat takibi
- Blok / bina bazlı raporlar

### 4.7 Vergi ve Finans Modülü
**Amaç:** Vergisel ve mali görünürlüğü sağlamak.

İçerik:
- Gelir-gider kayıtları
- Stopaj / KDV / vergi türleri
- Vergi dönemleri
- Vergi takvimi ve hatırlatma
- Malik bazlı ödeme dağıtımı
- Banka entegrasyonu
- Muhasebe dışa aktarımı
- Vergiye hazır raporlar

> Not: Uluslararası ürünlerde “tax-ready reporting” güçlüdür; fakat Türkiye’ye özgü resmi beyan/e-belge süreçleri için ek entegrasyon veya özel geliştirme gerekecektir.

### 4.8 Bakım / Arıza / İş Emri Modülü
**Amaç:** Arıza taleplerinin uçtan uca takibi.

İçerik:
- Arıza başvurusu
- Fotoğraf / belge ekleme
- Öncelik ve kategori
- Görev atama
- Tedarikçi / servis yönlendirme
- İş emri durumu
- Maliyet takibi
- Kapanış ve memnuniyet kaydı

### 4.9 Sayaç / Fatura / Yan Gider Modülü
**Amaç:** Elektrik, su, doğalgaz, internet vb. giderleri takip etmek.

İçerik:
- Sayaç kartları
- Endeks girişleri
- Otomatik tüketim hesaplama
- Fatura kayıtları
- Kiracıya yansıtma
- Son ödeme tarihi hatırlatması

### 4.10 Doküman Yönetimi
**Amaç:** Evrakları tek yerde toplamak.

İçerik:
- Tapu, sigorta, sözleşme, vergi evrakları
- Dosya klasörleme
- Etiketleme
- Yetkilendirme
- Evrak son geçerlilik tarihi hatırlatma

### 4.11 Bildirim ve İletişim Modülü
**Amaç:** Tüm paydaşlarla düzenli iletişim.

İçerik:
- SMS
- E-posta
- WhatsApp / push entegrasyon altyapısı
- Toplu duyuru
- Otomatik hatırlatma senaryoları
- Şablon mesajlar

### 4.12 Raporlama ve Dashboard
**Amaç:** Yönetici kararlarını hızlandırmak.

İçerik:
- Doluluk oranı
- Toplam kira tahakkuku
- Tahsilat oranı
- Geciken alacaklar
- Vergi takvimi yaklaşan işler
- Arıza yoğunluğu
- Bina / malik / kiracı bazlı performans
- Aylık / yıllık gelir-gider analizi

### 4.13 Yetki ve Rol Yönetimi
**Amaç:** Güvenli çok kullanıcılı yapı.

İçerik:
- Yönetici
- Muhasebe
- Operasyon
- Saha personeli
- Malik görüntüleme hesabı
- Kiracı self-service hesabı

### 4.14 Mobil Kullanım Modülü
**Amaç:** Sahada hızlı işlem.

İçerik:
- Mobil uyumlu panel
- Fotoğraflı arıza girişi
- Mobil tahsilat kontrolü
- Yerinde denetim / kontrol formu
- Push bildirimler

### 4.15 Entegrasyon Modülü
**Amaç:** Sistemi dış servislerle konuşturmak.

İçerik:
- Banka / sanal POS
- Muhasebe programı
- e-Fatura / e-Arşiv / ERP
- SMS servisleri
- Kimlik / sözleşme imza servisleri
- API katmanı

---

## 5) Programın sahip olması gereken temel yetenekler

### Zorunlu yetenekler
- Çoklu mülk ve çoklu bağımsız bölüm yönetimi
- Konut + işyeri karmasını destekleme
- Kira tahakkuku ve tahsilat takibi
- Vergi / finans hatırlatmaları
- Bakım / arıza iş akışı
- Malik, kiracı ve yönetici bazlı erişim
- Güçlü raporlama
- Belge yönetimi
- Mobil uyumluluk
- Bildirim altyapısı

### Güçlü fark yaratacak yetenekler
- Otomatik banka hareketi eşleştirme
- Gecikme riski analizi
- Kira sözleşmesi bitiş uyarıları
- Boş/dolu tahmin analizi
- Bakım maliyet trend raporları
- Malik bazlı kârlılık görünümü
- API ile dış sistem entegrasyonu
- Denetim/checklist altyapısı

---

## 6) Bu müşteri için önerilen ürün yaklaşımı

100–200 bağımsız bölüm için mantıklı ürün yaklaşımı:

### Seviye 1 – Temel ihtiyaçlar
- Mülk
- Kiracı
- Malik
- Sözleşme
- Kira tahakkuku
- Tahsilat
- Gelir-gider
- Arıza kaydı
- Raporlama

### Seviye 2 – Operasyonel güçlendirme
- Aidat
- Sayaç
- Bildirim merkezi
- Doküman yönetimi
- Mobil saha ekranları
- Tedarikçi / servis yönetimi

### Seviye 3 – Kurumsallaşma
- Vergi takvimi
- Banka entegrasyonu
- e-Belge / ERP entegrasyonu
- Gelişmiş dashboard
- Yetki matrisi
- API ve dış sistem bağlantıları

---

## 7) Sonuç

Web araştırmasına göre pazardaki güçlü ürünler, özellikle şu eksenlerde birleşiyor:

- **Kira toplama**
- **Sözleşme yönetimi**
- **Bakım / arıza yönetimi**
- **Muhasebe ve finans**
- **Kiracı / malik portalları**
- **Raporlama ve mobil kullanım**

Türkiye’de apartman/site/rezidans yönetimi tarafında **Apsiyon** benzeri yapılar; aidat, sayaç, tahsilat ve yönetim iletişimi için güçlü örnek sunuyor. Karma portföy ve profesyonel kira yönetiminde ise **Buildium**, **DoorLoop**, **AppFolio** ve **TenantCloud** gibi ürünlerin modül yapısı iyi referans veriyor.

Bu nedenle 100–200 daire/işyeri olan müşteri için geliştirilecek yazılımın tek cümlelik özeti şöyle olabilir:

**“Portföy + kira + finans/vergi + bakım/arıza + raporlama + mobil iletişim” odaklı, çok kullanıcılı ve entegrasyona açık bir mülk yönetim platformu.**
