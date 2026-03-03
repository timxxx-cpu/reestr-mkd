package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "floors")
public class FloorEntity extends BaseEntity {

    @Column(name = "block_id")
    private String blockId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "block_id", insertable = false, updatable = false)
    private BuildingBlockEntity block;

    @OneToMany(mappedBy = "floor", fetch = FetchType.LAZY)
    private List<UnitEntity> units = new ArrayList<>();

    @OneToMany(mappedBy = "floor", fetch = FetchType.LAZY)
    private List<CommonAreaEntity> commonAreas = new ArrayList<>();

    @Column(name = "extension_id")
    private String extensionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "extension_id", insertable = false, updatable = false)
    private BlockExtensionEntity extension;

    @Column(name = "index", nullable = false)
    private Integer index;

    @Column(name = "floor_key")
    private String floorKey;

    @Column(name = "label")
    private String label;

    @Column(name = "floor_type")
    private String floorType;

    @Column(name = "height")
    private BigDecimal height;

    @Column(name = "area_proj")
    private BigDecimal areaProj;

    @Column(name = "area_fact")
    private BigDecimal areaFact;

    @Column(name = "is_duplex")
    private Boolean isDuplex = false;

    @Column(name = "parent_floor_index")
    private Integer parentFloorIndex;

    @Column(name = "basement_id")
    private String basementId;

    @Column(name = "is_technical")
    private Boolean isTechnical = false;

    @Column(name = "is_commercial")
    private Boolean isCommercial = false;

    @Column(name = "is_stylobate")
    private Boolean isStylobate = false;

    @Column(name = "is_basement")
    private Boolean isBasement = false;

    @Column(name = "is_attic")
    private Boolean isAttic = false;

    @Column(name = "is_loft")
    private Boolean isLoft = false;

    @Column(name = "is_roof")
    private Boolean isRoof = false;
}
