package uz.reestrmkd.backend.domain.registry.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "block_extensions")
public class BlockExtensionEntity {
    @Id
    private UUID id;
    @Column(name = "building_id", nullable = false)
    private UUID buildingId;
    @Column(name = "parent_block_id", nullable = false)
    private UUID parentBlockId;
    @Column(nullable = false)
    private String label;
    @Column(name = "extension_type")
    private String extensionType;
    @Column(name = "construction_kind")
    private String constructionKind;
    @Column(name = "floors_count")
    private Integer floorsCount;
    @Column(name = "start_floor_index")
    private Integer startFloorIndex;
    @Column(name = "vertical_anchor_type")
    private String verticalAnchorType;
    @Column(name = "anchor_floor_key")
    private String anchorFloorKey;
    private String notes;
    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "updated_at")
    private Instant updatedAt;
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBuildingId() { return buildingId; }
    public void setBuildingId(UUID buildingId) { this.buildingId = buildingId; }
    public UUID getParentBlockId() { return parentBlockId; }
    public void setParentBlockId(UUID parentBlockId) { this.parentBlockId = parentBlockId; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getExtensionType() { return extensionType; }
    public void setExtensionType(String extensionType) { this.extensionType = extensionType; }
    public String getConstructionKind() { return constructionKind; }
    public void setConstructionKind(String constructionKind) { this.constructionKind = constructionKind; }
    public Integer getFloorsCount() { return floorsCount; }
    public void setFloorsCount(Integer floorsCount) { this.floorsCount = floorsCount; }
    public Integer getStartFloorIndex() { return startFloorIndex; }
    public void setStartFloorIndex(Integer startFloorIndex) { this.startFloorIndex = startFloorIndex; }
    public String getVerticalAnchorType() { return verticalAnchorType; }
    public void setVerticalAnchorType(String verticalAnchorType) { this.verticalAnchorType = verticalAnchorType; }
    public String getAnchorFloorKey() { return anchorFloorKey; }
    public void setAnchorFloorKey(String anchorFloorKey) { this.anchorFloorKey = anchorFloorKey; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
