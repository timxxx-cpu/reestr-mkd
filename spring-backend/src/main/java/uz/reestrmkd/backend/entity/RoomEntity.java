package uz.reestrmkd.backend.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "rooms")
public class RoomEntity {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id", nullable = false)
    private UnitEntity unit;
    @Column(name = "room_type")
    private String roomType;
    private String name;
    private BigDecimal area;
    @Column(name = "room_height")
    private BigDecimal roomHeight;
    private Integer level;
    @Column(name = "is_mezzanine")
    private Boolean isMezzanine;
    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "updated_at")
    private Instant updatedAt;
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UnitEntity getUnit() { return unit; }
    public void setUnit(UnitEntity unit) { this.unit = unit; }
    public UUID getUnitId() { return unit == null ? null : unit.getId(); }
    public String getRoomType() { return roomType; }
    public void setRoomType(String roomType) { this.roomType = roomType; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getArea() { return area; }
    public void setArea(BigDecimal area) { this.area = area; }
    public BigDecimal getRoomHeight() { return roomHeight; }
    public void setRoomHeight(BigDecimal roomHeight) { this.roomHeight = roomHeight; }
    public Integer getLevel() { return level; }
    public void setLevel(Integer level) { this.level = level; }
    public Boolean getIsMezzanine() { return isMezzanine; }
    public void setIsMezzanine(Boolean mezzanine) { isMezzanine = mezzanine; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
