package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "entrance_matrix")
public class EntranceMatrixEntity extends BaseEntity {

    @Column(name = "block_id", nullable = false)
    private String blockId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "block_id", insertable = false, updatable = false)
    private BuildingBlockEntity block;

    @Column(name = "floor_id", nullable = false)
    private String floorId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_id", insertable = false, updatable = false)
    private FloorEntity floor;

    @Column(name = "entrance_number", nullable = false)
    private Integer entranceNumber;

    @Column(name = "flats_count")
    private Integer flatsCount = 0;

    @Column(name = "commercial_count")
    private Integer commercialCount = 0;

    @Column(name = "mop_count")
    private Integer mopCount = 0;
}
