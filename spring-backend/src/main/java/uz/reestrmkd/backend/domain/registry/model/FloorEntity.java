package uz.reestrmkd.backend.domain.registry.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "floors")
public class FloorEntity {
    @Id
    private UUID id;
    @Column(name = "block_id")
    private UUID blockId;
    @Column(name = "extension_id")
    private UUID extensionId;
    @Column(name = "floor_key")
    private String floorKey;
    private String label;
    @Column(name = "floor_type")
    private String floorType;
    @Column(name = "index")
    private Integer index;
    private BigDecimal height;
    @Column(name = "area_proj")
    private BigDecimal areaProj;
    @Column(name = "area_fact")
    private BigDecimal areaFact;
    @Column(name = "is_duplex")
    private Boolean isDuplex;
    @Column(name = "parent_floor_index")
    private Integer parentFloorIndex;
    @Column(name = "basement_id")
    private UUID basementId;
    @Column(name = "is_technical")
    private Boolean isTechnical;
    @Column(name = "is_commercial")
    private Boolean isCommercial;
    @Column(name = "is_stylobate")
    private Boolean isStylobate;
    @Column(name = "is_basement")
    private Boolean isBasement;
    @Column(name = "is_attic")
    private Boolean isAttic;
    @Column(name = "is_loft")
    private Boolean isLoft;
    @Column(name = "is_roof")
    private Boolean isRoof;
    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "updated_at")
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBlockId() { return blockId; }
    public void setBlockId(UUID blockId) { this.blockId = blockId; }
    public UUID getExtensionId() { return extensionId; }
    public void setExtensionId(UUID extensionId) { this.extensionId = extensionId; }
    public String getFloorKey() { return floorKey; }
    public void setFloorKey(String floorKey) { this.floorKey = floorKey; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getFloorType() { return floorType; }
    public void setFloorType(String floorType) { this.floorType = floorType; }
    public Integer getIndex() { return index; }
    public void setIndex(Integer index) { this.index = index; }
    public BigDecimal getHeight() { return height; }
    public void setHeight(BigDecimal height) { this.height = height; }
    public BigDecimal getAreaProj() { return areaProj; }
    public void setAreaProj(BigDecimal areaProj) { this.areaProj = areaProj; }
    public BigDecimal getAreaFact() { return areaFact; }
    public void setAreaFact(BigDecimal areaFact) { this.areaFact = areaFact; }
    public Boolean getIsDuplex() { return isDuplex; }
    public void setIsDuplex(Boolean duplex) { isDuplex = duplex; }
    public Integer getParentFloorIndex() { return parentFloorIndex; }
    public void setParentFloorIndex(Integer parentFloorIndex) { this.parentFloorIndex = parentFloorIndex; }
    public UUID getBasementId() { return basementId; }
    public void setBasementId(UUID basementId) { this.basementId = basementId; }
    public Boolean getIsTechnical() { return isTechnical; }
    public void setIsTechnical(Boolean technical) { isTechnical = technical; }
    public Boolean getIsCommercial() { return isCommercial; }
    public void setIsCommercial(Boolean commercial) { isCommercial = commercial; }
    public Boolean getIsStylobate() { return isStylobate; }
    public void setIsStylobate(Boolean stylobate) { isStylobate = stylobate; }
    public Boolean getIsBasement() { return isBasement; }
    public void setIsBasement(Boolean basement) { isBasement = basement; }
    public Boolean getIsAttic() { return isAttic; }
    public void setIsAttic(Boolean attic) { isAttic = attic; }
    public Boolean getIsLoft() { return isLoft; }
    public void setIsLoft(Boolean loft) { isLoft = loft; }
    public Boolean getIsRoof() { return isRoof; }
    public void setIsRoof(Boolean roof) { isRoof = roof; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
