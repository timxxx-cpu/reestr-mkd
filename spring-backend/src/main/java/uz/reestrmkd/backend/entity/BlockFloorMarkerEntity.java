package uz.reestrmkd.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "block_floor_markers")
public class BlockFloorMarkerEntity {
    @Id
    private UUID id;
    @Column(name = "block_id", nullable = false)
    private UUID blockId;
    @Column(name = "marker_key")
    private String markerKey;
    @Column(name = "floor_index")
    private Integer floorIndex;
    @Column(name = "marker_type")
    private String markerType;
    @Column(name = "is_technical")
    private Boolean isTechnical;
    @Column(name = "is_commercial")
    private Boolean isCommercial;
    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "updated_at")
    private Instant updatedAt;
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBlockId() { return blockId; }
    public void setBlockId(UUID blockId) { this.blockId = blockId; }
    public String getMarkerKey() { return markerKey; }
    public void setMarkerKey(String markerKey) { this.markerKey = markerKey; }
    public Integer getFloorIndex() { return floorIndex; }
    public void setFloorIndex(Integer floorIndex) { this.floorIndex = floorIndex; }
    public String getMarkerType() { return markerType; }
    public void setMarkerType(String markerType) { this.markerType = markerType; }
    public Boolean getIsTechnical() { return isTechnical; }
    public void setIsTechnical(Boolean technical) { isTechnical = technical; }
    public Boolean getIsCommercial() { return isCommercial; }
    public void setIsCommercial(Boolean commercial) { isCommercial = commercial; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
