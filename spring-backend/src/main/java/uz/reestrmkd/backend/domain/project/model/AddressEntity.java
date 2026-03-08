package uz.reestrmkd.backend.domain.project.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "addresses")
public class AddressEntity {
    @Id
    private UUID id;

    @Column(nullable = false)
    private String dtype;

    @Column(nullable = false)
    private Integer versionrev;

    @Column(name = "district")
    private String district;

    @Column(name = "street")
    private UUID street;

    @Column(name = "mahalla")
    private UUID mahalla;

    @Column(name = "city")
    private String city;

    @Column(name = "building_no")
    private String buildingNo;

    @Column(name = "full_address")
    private String fullAddress;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getDtype() { return dtype; }
    public void setDtype(String dtype) { this.dtype = dtype; }
    public Integer getVersionrev() { return versionrev; }
    public void setVersionrev(Integer versionrev) { this.versionrev = versionrev; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
    public UUID getStreet() { return street; }
    public void setStreet(UUID street) { this.street = street; }
    public UUID getMahalla() { return mahalla; }
    public void setMahalla(UUID mahalla) { this.mahalla = mahalla; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getBuildingNo() { return buildingNo; }
    public void setBuildingNo(String buildingNo) { this.buildingNo = buildingNo; }
    public String getFullAddress() { return fullAddress; }
    public void setFullAddress(String fullAddress) { this.fullAddress = fullAddress; }
}
