package uz.reestrmkd.backend.domain.registry.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "units", uniqueConstraints = {
    @UniqueConstraint(name = "uq_units_floor_number", columnNames = {"floor_id", "number"})
})
public class UnitEntity {
    @Id
    private UUID id;
    @Column(name = "floor_id", nullable = false)
    private UUID floorId;
    @Column(name = "extension_id")
    private UUID extensionId;
    @Column(name = "entrance_id")
    private UUID entranceId;
    @Column(name = "unit_code")
    private String unitCode;
    private String number;
    @Column(name = "unit_type")
    private String unitType;
    @Column(name = "has_mezzanine")
    private Boolean hasMezzanine;
    @Column(name = "mezzanine_type")
    private String mezzanineType;
    @Column(name = "total_area")
    private BigDecimal totalArea;
    @Column(name = "living_area")
    private BigDecimal livingArea;
    @Column(name = "useful_area")
    private BigDecimal usefulArea;
    @Column(name = "rooms_count")
    private Integer roomsCount;
    private String status;
    @Column(name = "cadastre_number")
    private String cadastreNumber;
    @Column(name = "address_id")
    private UUID addressId;
    @OneToMany(mappedBy = "unit", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RoomEntity> rooms = new ArrayList<>();
    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "updated_at")
    private Instant updatedAt;
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getFloorId() { return floorId; }
    public void setFloorId(UUID floorId) { this.floorId = floorId; }
    public UUID getExtensionId() { return extensionId; }
    public void setExtensionId(UUID extensionId) { this.extensionId = extensionId; }
    public UUID getEntranceId() { return entranceId; }
    public void setEntranceId(UUID entranceId) { this.entranceId = entranceId; }
    public String getUnitCode() { return unitCode; }
    public void setUnitCode(String unitCode) { this.unitCode = unitCode; }
    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }
    public String getUnitType() { return unitType; }
    public void setUnitType(String unitType) { this.unitType = unitType; }
    public Boolean getHasMezzanine() { return hasMezzanine; }
    public void setHasMezzanine(Boolean hasMezzanine) { this.hasMezzanine = hasMezzanine; }
    public String getMezzanineType() { return mezzanineType; }
    public void setMezzanineType(String mezzanineType) { this.mezzanineType = mezzanineType; }
    public BigDecimal getTotalArea() { return totalArea; }
    public void setTotalArea(BigDecimal totalArea) { this.totalArea = totalArea; }
    public BigDecimal getLivingArea() { return livingArea; }
    public void setLivingArea(BigDecimal livingArea) { this.livingArea = livingArea; }
    public BigDecimal getUsefulArea() { return usefulArea; }
    public void setUsefulArea(BigDecimal usefulArea) { this.usefulArea = usefulArea; }
    public Integer getRoomsCount() { return roomsCount; }
    public void setRoomsCount(Integer roomsCount) { this.roomsCount = roomsCount; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getCadastreNumber() { return cadastreNumber; }
    public void setCadastreNumber(String cadastreNumber) { this.cadastreNumber = cadastreNumber; }
    public UUID getAddressId() { return addressId; }
    public void setAddressId(UUID addressId) { this.addressId = addressId; }
    public List<RoomEntity> getRooms() { return rooms; }
    public void setRooms(List<RoomEntity> rooms) { this.rooms = rooms; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
