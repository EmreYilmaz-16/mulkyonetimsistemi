# Profesyonel Mülk ve Kira Yönetim Sistemi - Modül Tasarımı

Bu doküman, 100-200 birimlik (Daire & İş Yeri) mülk portföyüne sahip yatırımcılar için ideal bir yönetim yazılımının sahip olması gereken modülleri ve yetenekleri özetlemektedir.

## 1. Mülk ve Envanter Yönetimi Modülü
* **Hiyerarşik Yapı:** Bina, blok, kat ve bağımsız bölüm bazlı tanımlama.
* **Mülk Detayları:** Tapu bilgileri, metrekare, kullanım türü (konut/ticari) ve demirbaş listeleri.
* **Doküman Arşivi:** Tapu fotokopileri, ruhsatlar ve projelerin dijital olarak saklanması.

## 2. Kiracı ve Sözleşme Yönetimi Modülü
* **Kiracı Kartı:** Kimlik bilgileri, findeks puanı (opsiyonel), iletişim ve acil durum bilgileri.
* **Dijital Kontrat:** Kira başlangıç/bitiş tarihleri, artış oranları (TÜFE/Sabit) ve özel şartların takibi.
* **Tahliye Taahhütnamesi Takibi:** Yasal sürelerin hatırlatılması.

## 3. Finansal Takip ve Tahsilat Modülü
* **Otomatik Kira Tahakkuku:** Her ay kiranın sisteme otomatik borç olarak yansıması.
* **Banka Entegrasyonu:** Gelen ödemelerin otomatik olarak ilgili mülkle eşleştirilmesi.
* **Gecikme Takibi:** Ödeme yapmayan kiracılara otomatik SMS ve E-posta hatırlatmaları.
* **Gider Yönetimi:** Tadilat, ortak alan giderleri ve personel maaşlarının kaydı.

## 4. Vergi ve Yasal Yükümlülük Modülü
* **Emlak Vergisi Takibi:** Mülk bazlı ödeme dönemlerinin (Mayıs/Kasım) hatırlatılması.
* **GMSİ (Kira Gelir Vergisi):** Yıllık beyanname öncesi gelir-gider dökümünün raporlanması.
* **DASK ve Sigorta:** Poliçe bitiş tarihlerinin takibi ve otomatik yenileme uyarıları.

## 5. Bakım ve Arıza Yönetimi Modülü
* **İş Emri Oluşturma:** Kiracıdan gelen arıza taleplerinin sisteme işlenmesi.
* **Tedarikçi Yönetimi:** Tesisatçı, elektrikçi vb. ustaların iletişim bilgileri ve geçmiş ödemeleri.
* **Periyodik Bakım:** Kombi, asansör veya yangın tüpü bakımlarının takvime bağlanması.

## 6. Raporlama ve Analiz Modülü
* **Doluluk Oranları:** Boş mülklerin analizi ve pazarlama süreçleri.
* **Karlılık Analizi:** Hangi mülkün net getirisi (Giderler çıktıktan sonra) daha yüksek?
* **Tahsilat Performansı:** Zamanında ödeme yapan ve geciktiren kiracıların listelenmesi.

## Sistemin Teknik Yetenekleri
- **Bulut Tabanlı (SaaS):** Her yerden, her cihazdan erişim (Mobil Uygulama desteği).
- **Rol Bazlı Yetkilendirme:** Muhasebecinin, emlak danışmanının ve mülk sahibinin farklı yetkilere sahip olması.
- **Otomatik Bildirimler:** Önemli tarihler (kontrat bitişi, vergi günü) için push notification veya SMS gönderimi.
- **Yüksek Güvenlik:** KVKK uyumlu veri saklama ve günlük yedekleme.